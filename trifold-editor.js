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
  const node = document.createElement(element.type === "image" ? "img" : "div");
  const fieldClass = element.field ? ` field-${element.field}` : "";
  node.className = `trifold-element trifold-element-${element.type}${fieldClass}${state.trifold.activeElementId === element.id ? " is-selected" : ""}`;
  node.dataset.elementId = element.id;
  node.style.left = `${element.x}px`;
  node.style.top = `${element.y}px`;
  node.style.width = `${element.width}px`;
  node.style.height = `${element.height}px`;
  node.style.transform = `rotate(${element.rotation || 0}deg)`;
  node.style.zIndex = String(10 + panelCard.querySelectorAll(".trifold-element").length);
  if (element.type === "image") {
    node.src = element.src;
    node.alt = element.alt || "Imagen del tríptico";
    node.draggable = false;
  } else if (element.type === "text") {
    node.textContent = element.text || (element.field === "title" ? "Sin título" : "Escribe el contenido...");
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
  node.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    startTrifoldElementDragging(event, element, panelCard, node);
  });
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    state.trifold.activeElementId = element.id;
    renderTrifoldPanels();
  });
  if (element.type === "text") {
    node.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      beginTrifoldInlineEdit(node, element);
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
  const mapWorkspace = $("#mapWorkspace");
  const enabled = trifoldWorkspace.hidden;
  if (enabled) {
    document.body.classList.add("trifold-mode");
    document.body.classList.remove("focus-mode");
    trifoldWorkspace.hidden = false;
    mapWorkspace.hidden = true;
    $("#trifoldButton").textContent = "Volver al mapa";
    renderTrifold();
  } else {
    document.body.classList.remove("trifold-mode");
    trifoldWorkspace.hidden = true;
    mapWorkspace.hidden = false;
    $("#trifoldButton").textContent = "Crear tríptico";
    renderConnections();
  }
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

  panelConfigs.forEach(({ id, title: pTitle, content: pContent, theme: pTheme, extraElements }) => {
    const panel = state.trifold.panels[id];
    if (!panel) return;
    panel.title = pTitle;
    panel.content = pContent;
    panel.theme = pTheme;
    panel.elements = createPanelTextElements(id, pTitle, pContent);
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
