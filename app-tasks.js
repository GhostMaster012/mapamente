let taskFilterSubject = "all";
let taskFilterCategory = "all";

function getTasks() {
  if (!Array.isArray(state.tasks)) state.tasks = [];
  return state.tasks;
}

function renderTasks() {
  const tasksContainer = document.getElementById("tasksList");
  const subjectFilter = document.getElementById("taskSubjectFilter");
  const taskCountBadge = document.getElementById("taskCountBadge");
  if (!tasksContainer) return;

  const tasks = getTasks();
  const subjects = [...new Set(tasks.map((t) => t.subject).filter(Boolean))];

  if (subjectFilter && document.activeElement !== subjectFilter) {
    const currentVal = subjectFilter.value;
    subjectFilter.innerHTML = '<option value="all">Todas las materias</option>' +
      subjects.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
    subjectFilter.value = subjects.includes(currentVal) || currentVal === "all" ? currentVal : "all";
  }

  const filtered = tasks.filter((t) => {
    const matchSubject = taskFilterSubject === "all" || t.subject === taskFilterSubject;
    const matchCat = taskFilterCategory === "all" || t.category === taskFilterCategory;
    return matchSubject && matchCat;
  });

  if (taskCountBadge) {
    const pending = tasks.filter((t) => !t.completed).length;
    taskCountBadge.textContent = `${pending} pendiente${pending === 1 ? "" : "s"}`;
  }

  if (!filtered.length) {
    tasksContainer.innerHTML = `
      <div class="empty-state tasks-empty">
        <div class="empty-icon">📝</div>
        <h2>Sin tareas ni apuntes aquí</h2>
        <p>Agrega una nueva tarea o apunte desde el panel izquierdo.</p>
      </div>
    `;
    return;
  }

  tasksContainer.innerHTML = "";
  filtered.forEach((task) => {
    const card = document.createElement("article");
    card.className = `task-card ${task.completed ? "is-completed" : ""}`;
    card.dataset.taskId = task.id;

    const categoryColors = {
      Tarea: "badge-blue",
      Examen: "badge-red",
      Proyecto: "badge-purple",
      Lectura: "badge-green",
      Apunte: "badge-yellow"
    };
    const catClass = categoryColors[task.category] || "badge-blue";

    card.innerHTML = `
      <div class="task-card-header">
        <label class="task-checkbox-label">
          <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} />
          <span class="task-title-text">${escapeHtml(task.title)}</span>
        </label>
        <div class="task-badges">
          ${task.subject ? `<span class="task-badge badge-subject">${escapeHtml(task.subject)}</span>` : ""}
          <span class="task-badge ${catClass}">${escapeHtml(task.category || "Tarea")}</span>
          ${task.dueDate ? `<span class="task-badge badge-due">📅 ${escapeHtml(task.dueDate)}</span>` : ""}
        </div>
      </div>
      ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ""}
      <div class="task-card-footer">
        <button class="button button-small button-outline convert-task-btn" type="button" title="Generar mapa conceptual con estas ideas">
          🗺️ Convertir a Mapa
        </button>
        <button class="button button-small button-danger delete-task-btn" type="button" title="Eliminar tarea">
          × Borrar
        </button>
      </div>
    `;

    const checkbox = card.querySelector(".task-checkbox");
    checkbox?.addEventListener("change", () => toggleTaskStatus(task.id));

    const convertBtn = card.querySelector(".convert-task-btn");
    convertBtn?.addEventListener("click", () => convertTaskToConceptMap(task.id));

    const deleteBtn = card.querySelector(".delete-task-btn");
    deleteBtn?.addEventListener("click", () => deleteTask(task.id));

    tasksContainer.appendChild(card);
  });
}

function addTask(event) {
  event.preventDefault();
  const titleInput = document.getElementById("taskTitleInput");
  const subjectInput = document.getElementById("taskSubjectInput");
  const categorySelect = document.getElementById("taskCategorySelect");
  const dueDateInput = document.getElementById("taskDueDateInput");
  const notesInput = document.getElementById("taskNotesInput");

  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) return;

  const newTask = {
    id: createId(),
    title,
    subject: subjectInput ? subjectInput.value.trim() : "",
    category: categorySelect ? categorySelect.value : "Tarea",
    dueDate: dueDateInput ? dueDateInput.value.trim() : "",
    notes: notesInput ? notesInput.value.trim() : "",
    completed: false
  };

  const tasks = getTasks();
  tasks.unshift(newTask);
  saveState();
  renderTasks();

  if (titleInput) titleInput.value = "";
  if (notesInput) notesInput.value = "";
  if (dueDateInput) dueDateInput.value = "";
  titleInput?.focus();
}

function toggleTaskStatus(taskId) {
  const task = getTasks().find((t) => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  saveState();
  renderTasks();
}

function deleteTask(taskId) {
  const task = getTasks().find((t) => t.id === taskId);
  if (!task || !window.confirm(`¿Eliminar la tarea “${task.title}”?`)) return;
  state.tasks = getTasks().filter((t) => t.id !== taskId);
  saveState();
  renderTasks();
}

function convertTaskToConceptMap(taskId) {
  const task = getTasks().find((t) => t.id === taskId);
  if (!task) return;

  if (state.nodes.length && !window.confirm("¿Crear un mapa conceptual a partir de este apunte/tarea? Reemplazará el mapa actual.")) {
    return;
  }

  pushHistory();
  state.title = task.title.toUpperCase();
  state.layoutMode = "standard";
  state.layoutVersion = 0;
  state.nodes = [];
  state.edges = [];

  if (task.subject) state.metadata.subject = task.subject;
  if (task.dueDate) state.metadata.dueDate = task.dueDate;
  state.metadata.activityName = task.title;

  const lines = (task.notes || "")
    .split("\n")
    .map((l) => l.replace(/^[•\-\d\.]+\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) {
    lines.push("Concepto principal", "Idea clave 1", "Idea clave 2");
  }

  const rootId = createId();
  state.nodes.push({
    id: rootId,
    title: task.title,
    content: task.subject ? `Materia: ${task.subject}` : "Idea central",
    x: 100,
    y: 100
  });

  lines.forEach((line) => {
    const childId = createId();
    state.nodes.push({
      id: childId,
      title: line.length > 40 ? line.slice(0, 38) + "..." : line,
      content: line.length > 40 ? line : "Detalle",
      x: 100,
      y: 100
    });
    state.edges.push({
      from: rootId,
      to: childId,
      label: "comprende"
    });
  });

  arrangeNodes();
  saveState();
  switchToWorkspace("map");
}

function switchToWorkspace(mode) {
  const mapWorkspace = $("#mapWorkspace");
  const trifoldWorkspace = $("#trifoldWorkspace");
  const tasksWorkspace = $("#tasksWorkspace");
  const trifoldBtn = $("#trifoldButton");
  const tasksBtn = $("#tasksButton");

  document.body.classList.remove("trifold-mode", "tasks-mode");

  if (mode === "trifold") {
    document.body.classList.add("trifold-mode");
    if (mapWorkspace) mapWorkspace.hidden = true;
    if (trifoldWorkspace) trifoldWorkspace.hidden = false;
    if (tasksWorkspace) tasksWorkspace.hidden = true;
    if (trifoldBtn) trifoldBtn.textContent = "Volver al mapa";
    if (tasksBtn) tasksBtn.textContent = "🎓 Mis Tareas";
    renderTrifold();
  } else if (mode === "tasks") {
    document.body.classList.add("tasks-mode");
    if (mapWorkspace) mapWorkspace.hidden = true;
    if (trifoldWorkspace) trifoldWorkspace.hidden = true;
    if (tasksWorkspace) tasksWorkspace.hidden = false;
    if (trifoldBtn) trifoldBtn.textContent = "Crear tríptico";
    if (tasksBtn) tasksBtn.textContent = "Volver al mapa";
    renderTasks();
  } else {
    if (mapWorkspace) mapWorkspace.hidden = false;
    if (trifoldWorkspace) trifoldWorkspace.hidden = true;
    if (tasksWorkspace) tasksWorkspace.hidden = true;
    if (trifoldBtn) trifoldBtn.textContent = "Crear tríptico";
    if (tasksBtn) tasksBtn.textContent = "🎓 Mis Tareas";
    renderConnections();
  }
}

function toggleTasksMode() {
  const tasksWorkspace = $("#tasksWorkspace");
  if (!tasksWorkspace) return;
  const isHidden = tasksWorkspace.hidden;
  switchToWorkspace(isHidden ? "tasks" : "map");
}
