function getTrifoldPanel(id) {
  if (!trifoldPanelIds.includes(id)) id = "front";
  const existing = state.trifold.panels[id];
  if (!existing || typeof existing !== "object") {
    const fallback = createDefaultTrifold().panels[id];
    state.trifold.panels[id] = fallback || { title: "Nuevo panel", content: "", theme: "mint", elements: [] };
  }
  const panel = state.trifold.panels[id];
  panel.title = typeof panel.title === "string" ? panel.title : "Nuevo panel";
  panel.content = typeof panel.content === "string" ? panel.content : "";
  panel.theme = trifoldThemes.includes(panel.theme) ? panel.theme : "mint";
  panel.elements = Array.isArray(panel.elements) ? panel.elements.map(normalizeTrifoldElement).filter(Boolean) : [];
  return panel;
}

function getVisibleTrifoldPanelIds() {
  return trifoldFacePanels[state.trifold.face] || trifoldFacePanels.exterior;
}

function syncTrifoldField(element, text) {
  if (!element.field) return;
  const panel = getTrifoldPanel(state.trifold.activePanel);
  element.text = text.slice(0, element.field === "title" ? 70 : 1200);
  if (element.field === "title") {
    panel.title = element.text;
    if (trifoldPanelTitle) trifoldPanelTitle.value = element.text;
  } else {
    panel.content = element.text;
    if (trifoldPanelContent) trifoldPanelContent.value = element.text;
  }
}

function beginTrifoldInlineEdit(node, element) {
  if (node.dataset.editing === "true") return;
  node.dataset.editing = "true";
  node.contentEditable = "true";
  node.style.userSelect = "text";
  node.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  const finish = () => {
    if (node.dataset.editing !== "true") return;
    const limit = element.field === "title" ? 70 : element.field === "content" ? 1200 : 500;
    const text = node.innerText.split(String.fromCharCode(160)).join(" ").slice(0, limit);
    if (element.field) syncTrifoldField(element, text);
    else element.text = text;
    node.contentEditable = "false";
    node.style.userSelect = "none";
    delete node.dataset.editing;
    renderTrifoldPanels();
    saveState();
  };
  node.addEventListener("blur", finish, { once: true });
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      node.textContent = element.text;
      node.blur();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      node.blur();
    }
  }, { once: false });
}

function createTrifoldElementNode(element, panelCard) {
  const node = document.createElement("div");
  const fieldClass = element.field ? ` field-${element.field}` : "";
  node.className = `trifold-element trifold-element-${element.type}${fieldClass}${state.trifold.activeElementId === element.id ? " is-selected" : ""}`;
  node.dataset.elementId = element.id;
  node.style.left = `${element.x}px`;
  node.style.top = `${element.y}px`;
  node.style.width = `${element.width}px`;
  node.style.height = `${element.height}px`;
  node.style.transform = `rotate(${element.rotation || 0}deg)`;
  node.style.zIndex = String(10 + panelCard.querySelectorAll(".trifold-element").length);

  const actions = document.createElement("div");
  actions.className = "element-actions";
  const delBtn = document.createElement("button");
  delBtn.className = "element-action-btn del-btn";
  delBtn.type = "button";
  delBtn.textContent = "×";
  delBtn.title = "Eliminar elemento";
  delBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.trifold.activeElementId = element.id;
    deleteActiveTrifoldElement();
  });
  actions.appendChild(delBtn);
  node.appendChild(actions);

  if (element.type === "image") {
    const img = document.createElement("img");
    img.src = element.src;
    img.alt = element.alt || "Imagen del tríptico";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "inherit";
    node.appendChild(img);
  } else if (element.type === "text") {
    const textSpan = document.createElement("div");
    textSpan.className = "trifold-text-inner";
    textSpan.textContent = element.text || (element.field === "title" ? "Sin título" : "Escribe el contenido...");
    node.appendChild(textSpan);
    node.style.fontSize = `${element.fontSize}px`;
    node.style.color = element.color;
    if (element.align) {
      node.style.textAlign = element.align;
      node.style.justifyContent = element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start";
    }
  } else {
    node.style.background = element.background;
    node.style.opacity = element.opacity;
  }

  if (state.trifold.activeElementId === element.id) {
    const handleSe = document.createElement("div");
    handleSe.className = "element-resize-handle handle-se";
    handleSe.title = "Arrastra para cambiar ancho y alto";
    handleSe.addEventListener("pointerdown", (e) => startTrifoldElementResizing(e, element, panelCard, node, "se"));
    node.appendChild(handleSe);

    const handleE = document.createElement("div");
    handleE.className = "element-resize-handle handle-e";
    handleE.title = "Arrastra para cambiar ancho";
    handleE.addEventListener("pointerdown", (e) => startTrifoldElementResizing(e, element, panelCard, node, "e"));
    node.appendChild(handleE);

    const handleS = document.createElement("div");
    handleS.className = "element-resize-handle handle-s";
    handleS.title = "Arrastra para cambiar alto";
    handleS.addEventListener("pointerdown", (e) => startTrifoldElementResizing(e, element, panelCard, node, "s"));
    node.appendChild(handleS);
  }

  node.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".element-actions") || event.target.closest(".element-resize-handle")) return;
    event.stopPropagation();
    startTrifoldElementDragging(event, element, panelCard, node);
  });
  node.addEventListener("click", (event) => {
    if (event.target.closest(".element-actions") || event.target.closest(".element-resize-handle")) return;
    event.stopPropagation();
    state.trifold.activeElementId = element.id;
    renderTrifoldPanels();
  });
  if (element.type === "text") {
    node.addEventListener("dblclick", (event) => {
      if (event.target.closest(".element-actions")) return;
      event.stopPropagation();
      const textSpan = node.querySelector(".trifold-text-inner") || node;
      beginTrifoldInlineEdit(textSpan, element);
    });
  }
  return node;
}

function renderTrifoldPanels() {
  if (!trifoldPanels) return;
  const visibleIds = getVisibleTrifoldPanelIds();
  const labels = {
    back: "Contraportada",
    flap: "Solapa exterior",
    front: "Portada",
    "inside-left": "Interior izquierdo",
    "inside-center": "Interior central",
    "inside-right": "Interior derecho"
  };
  trifoldPanels.innerHTML = "";
  visibleIds.forEach((id) => {
    const panel = getTrifoldPanel(id);
    const card = document.createElement("article");
    card.className = `trifold-panel theme-${panel.theme || "mint"}${id === state.trifold.activePanel ? " is-active" : ""}`;
    card.dataset.panelId = id;
    card.style.fontFamily = trifoldFonts[state.trifold.font] || trifoldFonts["dm-sans"];
    const label = document.createElement("span");
    label.className = "trifold-panel-label";
    label.textContent = labels[id];
    const elementsLayer = document.createElement("div");
    elementsLayer.className = "trifold-elements-layer";
    panel.elements.forEach((element) => elementsLayer.appendChild(createTrifoldElementNode(element, card)));
    card.append(label, elementsLayer);
    card.addEventListener("click", () => {
      state.trifold.activePanel = id;
      state.trifold.activeElementId = null;
      trifoldPanelSelect.value = id;
      updateTrifoldPanelForm();
      renderTrifoldPanels();
      saveState();
    });
    trifoldPanels.appendChild(card);
  });
  updateTrifoldElementInspector();
}

function startTrifoldElementDragging(event, element, panelCard, elementNode) {
  if (event.button !== 0) return;
  const rect = panelCard.getBoundingClientRect();
  state.trifold.activeElementId = element.id;
  elementNode.classList.add("is-selected");
  trifoldDragData = {
    element,
    panelCard,
    elementNode,
    startX: event.clientX,
    startY: event.clientY,
    originX: element.x,
    originY: element.y,
    panelWidth: rect.width,
    panelHeight: rect.height
  };
  elementNode.setPointerCapture?.(event.pointerId);
  document.addEventListener("pointermove", dragTrifoldElement);
  document.addEventListener("pointerup", stopTrifoldElementDragging, { once: true });
  document.addEventListener("pointercancel", stopTrifoldElementDragging, { once: true });
}

function dragTrifoldElement(event) {
  if (!trifoldDragData) return;
  const { element, elementNode, panelWidth, panelHeight } = trifoldDragData;
  const nextX = trifoldDragData.originX + event.clientX - trifoldDragData.startX;
  const nextY = trifoldDragData.originY + event.clientY - trifoldDragData.startY;
  element.x = Math.max(4, Math.min(panelWidth - element.width - 4, nextX));
  element.y = Math.max(4, Math.min(panelHeight - element.height - 4, nextY));
  elementNode.style.left = `${element.x}px`;
  elementNode.style.top = `${element.y}px`;
}

function stopTrifoldElementDragging() {
  if (!trifoldDragData) return;
  trifoldDragData = null;
  document.removeEventListener("pointermove", dragTrifoldElement);
  document.removeEventListener("pointercancel", stopTrifoldElementDragging);
  saveState();
}

let trifoldResizeData = null;

function startTrifoldElementResizing(event, element, panelCard, elementNode, direction) {
  if (event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();
  state.trifold.activeElementId = element.id;
  const rect = panelCard.getBoundingClientRect();
  trifoldResizeData = {
    element,
    panelCard,
    elementNode,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    originWidth: element.width || 200,
    originHeight: element.height || 60,
    panelWidth: rect.width,
    panelHeight: rect.height
  };
  event.target.setPointerCapture?.(event.pointerId);
  document.addEventListener("pointermove", resizeTrifoldElement);
  document.addEventListener("pointerup", stopTrifoldElementResizing, { once: true });
  document.addEventListener("pointercancel", stopTrifoldElementResizing, { once: true });
}

function resizeTrifoldElement(event) {
  if (!trifoldResizeData) return;
  const { element, elementNode, direction, startX, startY, originWidth, originHeight, panelWidth, panelHeight } = trifoldResizeData;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  if (direction === "se" || direction === "e") {
    const nextW = Math.max(50, Math.min(panelWidth - element.x - 4, originWidth + deltaX));
    element.width = Math.round(nextW);
    elementNode.style.width = `${element.width}px`;
  }
  if (direction === "se" || direction === "s") {
    const nextH = Math.max(20, Math.min(panelHeight - element.y - 4, originHeight + deltaY));
    element.height = Math.round(nextH);
    elementNode.style.height = `${element.height}px`;
  }

  const widthValue = $("#elemWidthValue");
  if (widthValue) widthValue.textContent = `${element.width}w`;
  const heightValue = $("#elemHeightValue");
  if (heightValue) heightValue.textContent = `${element.height}h`;
}

function stopTrifoldElementResizing() {
  if (!trifoldResizeData) return;
  trifoldResizeData = null;
  document.removeEventListener("pointermove", resizeTrifoldElement);
  document.removeEventListener("pointercancel", stopTrifoldElementResizing);
  updateTrifoldElementInspector();
  saveState();
}

function getActiveTrifoldPanel() {
  return getTrifoldPanel(state.trifold.activePanel);
}

function addTrifoldElement(type, values = {}) {
  const panel = getActiveTrifoldPanel();
  if (panel.elements.length >= 40) {
    window.alert("Este panel ya tiene el máximo de 40 elementos.");
    return;
  }
  const element = {
    id: createId(),
    type,
    field: values.field || "",
    text: values.text || "Texto nuevo",
    src: values.src || "",
    alt: values.alt || "Imagen del tríptico",
    x: values.x ?? 42,
    y: values.y ?? 120,
    width: values.width ?? (type === "text" ? 300 : 180),
    height: values.height ?? (type === "text" ? 70 : 140),
    fontSize: values.fontSize ?? 28,
    color: values.color || "#1f3029",
    background: values.background || "#ffffff",
    opacity: values.opacity ?? .78,
    rotation: values.rotation || 0
  };
  panel.elements.push(element);
  state.trifold.activeElementId = element.id;
  renderTrifoldPanels();
  saveState();
}

function addTrifoldText() {
  const text = window.prompt("Escribe el texto del elemento:", "Texto destacado");
  if (text === null || !text.trim()) return;
  addTrifoldElement("text", { text: text.trim() });
}

function addTrifoldShape() {
  addTrifoldElement("shape", { x: 55, y: 95, width: 220, height: 125, background: "#ffffff", opacity: .62 });
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      image.onload = () => {
        const maxSide = 1100;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ src: canvas.toDataURL("image/jpeg", .82), width: canvas.width, height: canvas.height });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function addTrifoldImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 12 * 1024 * 1024) {
    window.alert("La imagen original supera 12 MB. Elige una más ligera.");
    return;
  }
  try {
    const compressed = await compressImageFile(file);
    const ratio = compressed.width / compressed.height;
    const width = ratio >= 1 ? 220 : Math.max(90, 220 * ratio);
    const height = ratio >= 1 ? Math.max(90, 220 / ratio) : 220;
    addTrifoldElement("image", { src: compressed.src, alt: file.name, width, height, x: 55, y: 120 });
  } catch (error) {
    console.error(error);
    window.alert("No se pudo agregar la imagen.");
  }
}

function deleteActiveTrifoldElement() {
  const panel = getActiveTrifoldPanel();
  const activeId = state.trifold.activeElementId;
  if (!activeId) return;
  const element = panel.elements.find((item) => item.id === activeId);
  if (!element) return;
  if (element.field === "title") {
    panel.title = "";
    if (trifoldPanelTitle) trifoldPanelTitle.value = "";
  } else if (element.field === "content") {
    panel.content = "";
    if (trifoldPanelContent) trifoldPanelContent.value = "";
  }
  panel.elements = panel.elements.filter((item) => item.id !== activeId);
  state.trifold.activeElementId = null;
  renderTrifoldPanels();
  updateTrifoldPanelForm();
  updateTrifoldElementInspector();
  saveState();
}

function updateTrifoldPanelForm() {
  if (!trifoldPanelSelect) return;
  const panel = getTrifoldPanel(state.trifold.activePanel);
  trifoldPanelSelect.value = state.trifold.activePanel;
  trifoldPanelTitle.value = panel.title || "";
  trifoldPanelContent.value = panel.content || "";
  trifoldPanelTheme.value = panel.theme || "mint";
}

function renderTrifold() {
  if (!trifoldWorkspace) return;
  trifoldTitleInput.value = state.trifold.title || "Mi tríptico";
  trifoldTitleDisplay.textContent = state.trifold.title || "Mi tríptico";
  trifoldFaceLabel.textContent = state.trifold.face === "interior" ? "Cara interior" : "Cara exterior";
  trifoldDesignSelect.value = state.trifold.design;
  trifoldFontSelect.value = state.trifold.font;
  trifoldBoard.classList.remove(...trifoldDesigns.map((design) => `design-${design}`));
  trifoldBoard.classList.add(`design-${state.trifold.design}`);
  trifoldBoard.style.setProperty("--trifold-font", trifoldFonts[state.trifold.font] || trifoldFonts["dm-sans"]);
  renderTrifoldPanels();
  updateTrifoldPanelForm();
}

function setTrifoldFace(face) {
  const nextFace = face === "interior" ? "interior" : "exterior";
  state.trifold.face = nextFace;
  const visiblePanels = trifoldFacePanels[nextFace];
  if (!visiblePanels.includes(state.trifold.activePanel)) state.trifold.activePanel = visiblePanels[0];
  state.trifold.activeElementId = null;
  renderTrifold();
  saveState();
}

function toggleTrifoldMode() {
  const isHidden = trifoldWorkspace ? trifoldWorkspace.hidden : true;
  switchToWorkspace(isHidden ? "trifold" : "map");
}

function getActiveTrifoldElement() {
  const panel = getActiveTrifoldPanel();
  return panel.elements.find((item) => item.id === state.trifold.activeElementId);
}

function updateTrifoldElementInspector() {
  const inspector = $("#trifoldElementInspector");
  if (!inspector) return;
  const element = getActiveTrifoldElement();
  if (!element) {
    inspector.hidden = true;
    return;
  }
  inspector.hidden = false;
  const typeBadge = $("#inspectorElementType");
  if (typeBadge) {
    typeBadge.textContent = element.type === "image" ? "Foto" : element.type === "shape" ? "Forma" : "Texto";
  }
  const sizeValue = $("#elemFontSize");
  if (sizeValue) {
    sizeValue.textContent = `${element.fontSize || 28}px`;
  }
  const widthValue = $("#elemWidthValue");
  if (widthValue) {
    widthValue.textContent = `${Math.round(element.width || 200)}w`;
  }
  const heightValue = $("#elemHeightValue");
  if (heightValue) {
    heightValue.textContent = `${Math.round(element.height || 60)}h`;
  }
}

function changeActiveElementWidth(delta) {
  const element = getActiveTrifoldElement();
  if (!element) return;
  element.width = Math.max(50, Math.min(410, Math.round((element.width || 200) + delta)));
  renderTrifoldPanels();
  saveState();
}

function changeActiveElementHeight(delta) {
  const element = getActiveTrifoldElement();
  if (!element) return;
  element.height = Math.max(20, Math.min(680, Math.round((element.height || 60) + delta)));
  renderTrifoldPanels();
  saveState();
}

function changeActiveElementFontSize(delta) {
  const element = getActiveTrifoldElement();
  if (!element || element.type !== "text") return;
  element.fontSize = Math.max(10, Math.min(80, (element.fontSize || 28) + delta));
  renderTrifoldPanels();
  saveState();
}

function setActiveElementAlign(align) {
  const element = getActiveTrifoldElement();
  if (!element || element.type !== "text") return;
  element.align = align;
  renderTrifoldPanels();
  saveState();
}

function setActiveElementColor(color) {
  const element = getActiveTrifoldElement();
  if (!element) return;
  if (element.type === "text") {
    element.color = color;
  } else if (element.type === "shape") {
    element.background = color;
  }
  renderTrifoldPanels();
  saveState();
}

function duplicateActiveTrifoldElement() {
  const panel = getActiveTrifoldPanel();
  const element = getActiveTrifoldElement();
  if (!element) return;
  if (panel.elements.length >= 40) {
    window.alert("Este panel ya tiene el máximo de 40 elementos.");
    return;
  }
  const copy = {
    ...element,
    id: createId(),
    x: Math.min(350, element.x + 25),
    y: Math.min(500, element.y + 25),
    field: ""
  };
  panel.elements.push(copy);
  state.trifold.activeElementId = copy.id;
  renderTrifoldPanels();
  saveState();
}

function bringActiveElementForward() {
  const panel = getActiveTrifoldPanel();
  const element = getActiveTrifoldElement();
  if (!element) return;
  panel.elements = panel.elements.filter((item) => item.id !== element.id);
  panel.elements.push(element);
  renderTrifoldPanels();
  saveState();
}

function toggleFoldGuides() {
  const guides = $("#trifoldFoldGuides");
  if (!guides) return;
  guides.classList.toggle("is-hidden");
}

function toggleTrifoldFace() {
  setTrifoldFace(state.trifold.face === "exterior" ? "interior" : "exterior");
}

function loadTrifoldTemplate(title, design, font, panelConfigs) {
  if (!window.confirm(`¿Cargar la plantilla «${title}»? Esto reemplazará el tríptico actual.`)) return;
  state.trifold.title = title;
  state.trifold.design = design;
  state.trifold.font = font;
  state.trifold.face = "exterior";
  state.trifold.activePanel = "front";
  state.trifold.activeElementId = null;

  panelConfigs.forEach(({ id, title: pTitle, content: pContent, theme: pTheme, extraElements, customElements }) => {
    const panel = state.trifold.panels[id];
    if (!panel) return;
    panel.title = pTitle;
    panel.content = pContent;
    panel.theme = pTheme;
    panel.elements = Array.isArray(customElements)
      ? customElements.map(normalizeTrifoldElement).filter(Boolean)
      : createPanelTextElements(id, pTitle, pContent);
    if (Array.isArray(extraElements)) {
      extraElements.forEach((el, idx) => {
        panel.elements.push({
          id: `${id}-extra-${idx}`,
          x: el.x || 35,
          y: el.y || 100,
          width: el.width || 200,
          height: el.height || 60,
          type: el.type || "shape",
          text: el.text || "",
          fontSize: el.fontSize || 16,
          color: el.color || "#1f3029",
          background: el.background || "#ffffff",
          opacity: el.opacity ?? 0.7,
          rotation: 0,
          field: ""
        });
      });
    }
  });

  renderTrifold();
  saveState();
}

function loadScientificTrifold() {
  loadTrifoldTemplate("Investigación Científica", "editorial", "lora", [
    { id: "front", title: "TÍTULO DEL PROYECTO", content: "Autores: Nombre del Alumno\nMateria / Laboratorio\nUniversidad", theme: "sky" },
    { id: "flap", title: "RESUMEN EJECUTIVO", content: "• Pregunta de investigación\n• Hipótesis planteada\n• Justificación del estudio", theme: "mint" },
    { id: "back", title: "FUENTES & CONTACTO", content: "1. Journal of Science (2024)\n2. Libro de texto universitario\n\nContacto: correo@universidad.edu", theme: "sky" },
    { id: "inside-left", title: "1. METODOLOGÍA", content: "Muestra y sujetos:\nVariables analizadas:\nInstrumentos utilizados:", theme: "mint" },
    { id: "inside-center", title: "2. RESULTADOS", content: "• Hallazgo principal 1\n• Análisis estadístico\n• Comparativa de datos", theme: "sun" },
    { id: "inside-right", title: "3. CONCLUSIONES", content: "• Confirmación de hipótesis\n• Limitaciones del estudio\n• Futuras líneas de investigación", theme: "coral" }
  ]);
}

function loadEssayTrifold() {
  loadTrifoldTemplate("Ensayo Académico", "minimal", "poppins", [
    { id: "front", title: "TÍTULO DEL ENSAYO", content: "Un análisis crítico y reflexivo\n\nNombre del Alumno\nProfesor(a):", theme: "lavender" },
    { id: "flap", title: "TESIS CENTRAL", content: "Postura y argumento principal que se defenderá a lo largo del trabajo.", theme: "mint" },
    { id: "back", title: "BIBLIOGRAFÍA", content: "• Citas en formato APA\n• Artículos académicos consultados\n• Fecha de entrega", theme: "lavender" },
    { id: "inside-left", title: "CONTEXTO", content: "Antecedentes históricos, marco teórico y definiciones clave.", theme: "mint" },
    { id: "inside-center", title: "ARGUMENTACIÓN", content: "1. Evidencia primaria y análisis\n2. Contraargumentos y refutación\n3. Casos de estudio", theme: "sun" },
    { id: "inside-right", title: "SÍNTESIS FINAL", content: "Cierre, reflexiones éticas e impacto en la disciplina.", theme: "coral" }
  ]);
}

function loadProjectTrifold() {
  loadTrifoldTemplate("Proyecto Universitario", "bold", "montserrat", [
    { id: "front", title: "NOMBRE DEL PROYECTO", content: "Innovación y Solución Práctica\n\nEquipo de Trabajo\nGrupo / Semestre", theme: "coral" },
    { id: "flap", title: "PROPUESTA DE VALOR", content: "¿Por qué es importante este proyecto? Beneficios directos y alcance.", theme: "mint" },
    { id: "back", title: "EQUIPO & CONTACTO", content: "Integrantes:\n• Alumno 1 (Líder)\n• Alumno 2 (Investigador)\n\nGitHub / Portafolio", theme: "sky" },
    { id: "inside-left", title: "EL PROBLEMA", content: "Diagnóstico actual de la problemática identificada en la comunidad.", theme: "coral" },
    { id: "inside-center", title: "NUESTRA SOLUCIÓN", content: "• Arquitectura del sistema\n• Funcionalidades clave\n• Presupuesto y viabilidad", theme: "sun" },
    { id: "inside-right", title: "PLAN DE ACCIÓN", content: "Fase 1: Prototipo\nFase 2: Pruebas\nFase 3: Implementación", theme: "mint" }
  ]);
}

const ETHICS_INSTITUTIONAL_BACK_TEXT = `Materia: Taller de Ética (Ago-Dic 2026)
Alumno: Fernando Muñoz Martinez
Numero de la unidad: Unidad I (1.1.2 y 1.1.3)
Numero de la actividad: Actividad 2
Nombre de la actividad: Tríptico
Bibliografía: 
Fieser, J. (s.f.). Ethics. Internet Encyclopedia of Philosophy. https://iep.utm.edu/ethics/

Colegio de Ciencias y Humanidades. (s.f.). Ética: problemas morales y ética filosófica. Portal Académico CCH, UNAM. https://portalacademico.cch.unam.mx/filosofia1/etica

Sayre-McCord, G. (2023). Metaethics. The Stanford Encyclopedia of Philosophy. https://plato.stanford.edu/entries/metaethics/

---------------------------------------------
Fecha de Entrega: 9 Septiembre de 2026`;

function loadEthicsResearchTrifold() {
  loadTrifoldTemplate("Ética: Lo que llevé", "editorial", "lora", [
    {
      id: "front",
      title: "TALLER DE ÉTICA",
      content: "1.1.2 Concepto y objeto de estudio de la Ética\n1.1.3 Ramas de la Ética: Metaética, Ética normativa y Ética aplicada\n\nTecnológico Nacional de México\nInstituto Tecnológico",
      theme: "sky"
    },
    {
      id: "flap",
      title: "TALLER DE ÉTICA",
      content: "«La ética es la reflexión crítica y fundamentación teórica que orienta la conducta humana hacia la vida recta y el bien común.»\n\nUnidad I · Semestre Ago-Dic 2026",
      theme: "mint"
    },
    {
      id: "back",
      title: "DATOS DE ENTREGA",
      content: ETHICS_INSTITUTIONAL_BACK_TEXT,
      theme: "sky",
      customElements: [
        {
          id: "back-title",
          type: "text",
          field: "title",
          text: "DATOS DE ENTREGA",
          x: 20,
          y: 20,
          width: 380,
          height: 40,
          fontSize: 18,
          color: "#1f3029",
          background: "transparent",
          opacity: 1
        },
        {
          id: "back-content",
          type: "text",
          field: "content",
          text: ETHICS_INSTITUTIONAL_BACK_TEXT,
          x: 20,
          y: 65,
          width: 380,
          height: 485,
          fontSize: 12.5,
          color: "#2a3a32",
          background: "transparent",
          opacity: 1
        }
      ]
    },
    {
      id: "inside-left",
      title: "1.1.2 CONCEPTO Y OBJETO DE ESTUDIO",
      content: "• Concepto de Ética:\nRama de la filosofía que reflexiona de forma racional y crítica sobre la moral, evaluando qué conductas humanas son correctas o incorrectas para alcanzar el bien común y la vida recta.\n\n• Etimología:\nProviene del griego êthos (carácter, costumbre).\n\n• Ética vs. Moral:\n- Moral: Práctica social cotidiana (normas y costumbres recibidas).\n- Ética: Teoría filosófica que reflexiona y fundamenta esas normas.\n\n• Objeto de Estudio:\n- Objeto Material: Los actos humanos realizados con plena conciencia, libertad y voluntad (excluye actos involuntarios o biológicos).\n- Objeto Formal: La moralidad de esos actos (bondad, rectitud o malicia).",
      theme: "mint"
    },
    {
      id: "inside-center",
      title: "1.1.3 RAMAS: METAÉTICA Y NORMATIVA",
      content: "• Metaética:\nEstudia el origen, significado y naturaleza de los conceptos morales. Analiza si valores como \"lo bueno\" o \"lo justo\" son hechos objetivos o invenciones humanas (¿Qué significa \"bueno\"?).\n\n- Dimensiones de análisis:\n  • Ontológica: ¿De dónde surgen los valores morales?\n  • Semántica: Significado del lenguaje y juicios morales (+ / -).\n  • Epistemológica: Cómo conocemos lo moralmente correcto.\n  • Dilemas morales: tatuajes, maternidad en soltería, divorcio.\n\n• Ética Normativa:\nEstablece reglas, principios y criterios generales sobre cómo debemos actuar en sociedad.\n- Construye estándares mínimos de conducta orientados hacia el bien común (el deber, las consecuencias o la virtud).",
      theme: "sun"
    },
    {
      id: "inside-right",
      title: "ÉTICA APLICADA & SÍNTESIS",
      content: "• Ética Aplicada:\nAplica las teorías y principios morales a casos y dilemas reales y específicos de la sociedad y las profesiones:\n\n- Bioética: Medicina, biotecnología, clonación y vida.\n- Ética Profesional y Negocios: Deontología, honestidad laboral y comercio justo.\n- Ética Ambiental: Preservación del ecosistema y sustentabilidad.\n\n• Relación Fundamental de Principios:\n- Principio: Norma fundamental de actuación.\n- Valor: Práctica real de convicciones en el día a día.\n- Moral: Criterio práctico de lo correcto vs. incorrecto.",
      theme: "coral"
    }
  ]);
}

function loadEthicsClassTrifold() {
  loadTrifoldTemplate("Ética: Visto en clase", "minimal", "poppins", [
    {
      id: "front",
      title: "TALLER DE ÉTICA",
      content: "1.1.2 Concepto y objeto de estudio de la Ética\n1.1.3 Ramas de la Ética: Metaética, Normativa y Aplicada\n\nApuntes y Síntesis de Clase Presencial",
      theme: "lavender"
    },
    {
      id: "flap",
      title: "TALLER DE ÉTICA",
      content: "«No busca dictar qué se debe hacer, sino reflexionar críticamente sobre qué hace que una acción sea correcta o incorrecta en la vida diaria.»\n\nUnidad I · Semestre Ago-Dic 2026",
      theme: "mint"
    },
    {
      id: "back",
      title: "DATOS DE ENTREGA",
      content: ETHICS_INSTITUTIONAL_BACK_TEXT,
      theme: "lavender",
      customElements: [
        {
          id: "back-title",
          type: "text",
          field: "title",
          text: "DATOS DE ENTREGA",
          x: 20,
          y: 20,
          width: 380,
          height: 40,
          fontSize: 18,
          color: "#1f3029",
          background: "transparent",
          opacity: 1
        },
        {
          id: "back-content",
          type: "text",
          field: "content",
          text: ETHICS_INSTITUTIONAL_BACK_TEXT,
          x: 20,
          y: 65,
          width: 380,
          height: 485,
          fontSize: 12.5,
          color: "#2a3a32",
          background: "transparent",
          opacity: 1
        }
      ]
    },
    {
      id: "inside-left",
      title: "1.1.2 CONCEPTO Y OBJETO DE ESTUDIO",
      content: "• Concepto Visto en Clase:\nCiencia teórica y práctica que analiza racional y sistemáticamente los fundamentos del comportamiento moral humano, buscando el bien común y la vida recta.\n\n• Enfoque de reflexión:\nNo impone dogmas; reflexiona sobre los juicios y las decisiones tomadas en las relaciones personales del día a día.\n\n• Objeto Material y Formal:\n- Objeto Material: Actos humanos libres, conscientes y voluntarios.\n- Objeto Formal: La moralidad de los actos (bondad, rectitud o malicia).",
      theme: "mint"
    },
    {
      id: "inside-center",
      title: "1.1.3 METAÉTICA Y NORMATIVA",
      content: "• Metaética:\nEstudia la naturaleza de los conceptos morales (¿de dónde provienen los valores? ¿son objetivos o relativos?).\n- Trata cuestiones ontológicas, semánticas y epistemológicas.\n- Analiza juicios morales (+ / -) ante dilemas reales (tatuajes, divorcio, maternidad en soltería).\n\n• Ética Normativa:\nEstudia los valores morales para construir estándares mínimos (medidas) que orienten la conducta hacia el bien común.\n- Delimita con rigor lo correcto y lo incorrecto en sociedad.",
      theme: "sun"
    },
    {
      id: "inside-right",
      title: "1.1.3 ÉTICA APLICADA & CONCLUSIONES",
      content: "• Ética Aplicada en Acción:\nSe enfoca en la práctica de principios éticos y morales en contextos específicos y situaciones concretas:\n- Medicina y Bioética.\n- Negocios y Deontología.\n- Medio Ambiente y Sustentabilidad.\n\n• Conexiones Clave del Curso:\n- Principio ➔ Normas fundamentales.\n- Valor ➔ Práctica cotidiana de convicciones.\n- Moral ➔ Criterio de correcto vs. incorrecto.",
      theme: "coral"
    }
  ]);
}

function loadEthicsCompleteTrifold() {
  loadTrifoldTemplate("Ética: Integral", "editorial", "lora", [
    {
      id: "front",
      title: "TALLER DE ÉTICA",
      content: "1.1.2 Concepto y objeto de estudio de la Ética\n1.1.3 Ramas de la Ética: Metaética, Normativa y Aplicada\n\nInvestigación Teórica y Análisis de Clase\nTecnológico Nacional de México",
      theme: "sky"
    },
    {
      id: "flap",
      title: "TALLER DE ÉTICA",
      content: "«El estudio de la ética fundamenta nuestras decisiones conscientes hacia el bien común y la justicia social.»\n\nUnidad I · Semestre Ago-Dic 2026",
      theme: "mint"
    },
    {
      id: "back",
      title: "DATOS DE ENTREGA",
      content: ETHICS_INSTITUTIONAL_BACK_TEXT,
      theme: "sky",
      customElements: [
        {
          id: "back-title",
          type: "text",
          field: "title",
          text: "DATOS DE ENTREGA",
          x: 20,
          y: 20,
          width: 380,
          height: 40,
          fontSize: 18,
          color: "#1f3029",
          background: "transparent",
          opacity: 1
        },
        {
          id: "back-content",
          type: "text",
          field: "content",
          text: ETHICS_INSTITUTIONAL_BACK_TEXT,
          x: 20,
          y: 65,
          width: 380,
          height: 485,
          fontSize: 12.5,
          color: "#2a3a32",
          background: "transparent",
          opacity: 1
        }
      ]
    },
    {
      id: "inside-left",
      title: "1.1.2 CONCEPTO Y OBJETO DE ESTUDIO",
      content: "• Concepto de Ética:\nCiencia teórica y práctica (filosófica) que analiza racional y críticamente la moralidad de los actos humanos, buscando el bien común y la vida recta.\n\n• Etimología:\nDel griego êthos (carácter, costumbre).\n\n• Ética vs. Moral:\n- Moral: Práctica social cotidiana (normas y costumbres).\n- Ética: Reflexión teórica que las fundamenta racionalmente.\n\n• Objeto Material y Formal:\n- Objeto Material: Actos humanos libres, conscientes y voluntarios.\n- Objeto Formal: Moralidad de los actos (bondad, malicia o rectitud).",
      theme: "mint"
    },
    {
      id: "inside-center",
      title: "1.1.3 METAÉTICA Y NORMATIVA",
      content: "• Metaética (Origen y Naturaleza):\nEstudia si valores como \"lo bueno\" o \"lo justo\" son hechos objetivos o construcciones humanas.\n- Dimensiones: Ontológicas (origen moral), Semánticas (significado de términos) y Epistemológicas (conocimiento moral).\n- Analiza juicios (+ / -) ante dilemas de la vida cotidiana.\n\n• Ética Normativa (Reglas y Criterios):\nEstablece principios y estándares mínimos para orientar la conducta hacia el bien común (el deber, las consecuencias o la virtud).",
      theme: "sun"
    },
    {
      id: "inside-right",
      title: "1.1.3 ÉTICA APLICADA & CONCLUSIÓN",
      content: "• Ética Aplicada (Casos Reales):\nAplica las teorías morales a contextos y dilemas específicos:\n- Bioética: Medicina, salud, vida y clonación.\n- Ética Profesional y Negocios: Honestidad y deontología.\n- Ética Ambiental: Preservación de la naturaleza y sustentabilidad.\n\n• Relación Fundamental:\n- Principio ➔ Norma fundamental de conducta.\n- Valor ➔ Práctica real de convicciones diarias.\n- Moral ➔ Criterio de correcto vs. incorrecto.",
      theme: "coral"
    }
  ]);
}
