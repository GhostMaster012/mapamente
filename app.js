const STORAGE_KEY = "mapamente-concept-map";
const BOARD_WIDTH = 1000;
const BOARD_HEIGHT = 620;
const NODE_WIDTH = 190;
const NODE_HEIGHT = 100;
const ROOT_WIDTH = 260;
const ROOT_HEIGHT = 100;
const ROOT_ID = "__map-title__";
const metadataFields = ["subject", "student", "unit", "activityNumber", "activityName", "bibliography", "dueDate"];
const trifoldPanelIds = ["back", "flap", "front", "inside-left", "inside-center", "inside-right"];
const trifoldThemes = ["mint", "coral", "lavender", "sun", "sky"];
const trifoldDesigns = ["editorial", "pastel", "bold", "botanical", "minimal"];
const trifoldFonts = {
  "dm-sans": '"DM Sans", sans-serif',
  poppins: '"Poppins", sans-serif',
  montserrat: '"Montserrat", sans-serif',
  playfair: '"Playfair Display", serif',
  lora: '"Lora", serif',
  bebas: '"Bebas Neue", sans-serif',
  fira: '"Fira Sans", sans-serif'
};
const mapThemes = ["mint", "ocean", "lavender", "sunset", "ink"];
const trifoldFacePanels = {
  exterior: ["back", "flap", "front"],
  interior: ["inside-left", "inside-center", "inside-right"]
};

const state = loadState();
let selectedNodeIds = new Set();
let dragData = null;
let trifoldDragData = null;
let selectionData = null;
let suppressNextNodeClick = false;
let focusScroll = { left: 0, top: 0 };
let currentZoom = 1;
const undoStack = [];
const redoStack = [];

const $ = (selector) => document.querySelector(selector);
const titleInput = $("#titleInput");
const mapTitleDisplay = $("#mapTitleDisplay");
const nodeForm = $("#nodeForm");
const nodeTitleInput = $("#nodeTitleInput");
const nodeContentInput = $("#nodeContentInput");
const sourceSelect = $("#sourceSelect");
const targetSelect = $("#targetSelect");
const relationInput = $("#relationInput");
const mapBoard = $("#mapBoard");
const mapViewport = document.querySelector(".map-viewport");
const mapNodes = $("#mapNodes");
const connections = $("#connections");
const connectionLabels = $("#connectionLabels");
const selectionBox = $("#selectionBox");
const emptyState = $("#emptyState");
const trifoldWorkspace = $("#trifoldWorkspace");
const trifoldTitleInput = $("#trifoldTitleInput");
const trifoldTitleDisplay = $("#trifoldTitleDisplay");
const trifoldPanelSelect = $("#trifoldPanelSelect");
const trifoldPanelTitle = $("#trifoldPanelTitle");
const trifoldPanelContent = $("#trifoldPanelContent");
const trifoldPanelTheme = $("#trifoldPanelTheme");
const trifoldDesignSelect = $("#trifoldDesignSelect");
const trifoldFontSelect = $("#trifoldFontSelect");
const trifoldBoard = $("#trifoldBoard");
const trifoldPanels = $("#trifoldPanels");
const trifoldFaceLabel = $("#trifoldFaceLabel");
const mapThemeSelect = $("#mapThemeSelect");
const mapFontSelect = $("#mapFontSelect");
const trifoldImageInput = $("#trifoldImageInput");

function createPanelTextElements(panelId, title, content) {
  return [
    {
      id: `${panelId}-title`,
      type: "text",
      field: "title",
      text: title,
      x: 28,
      y: 122,
      width: 364,
      height: 92,
      fontSize: 25,
      color: "#1f3029",
      background: "transparent",
      opacity: 1,
      rotation: 0
    },
    {
      id: `${panelId}-content`,
      type: "text",
      field: "content",
      text: content,
      x: 28,
      y: 226,
      width: 364,
      height: 270,
      fontSize: 14,
      color: "#53645c",
      background: "transparent",
      opacity: 1,
      rotation: 0
    }
  ];
}

function ensurePanelTextElements(elements, panelId, title, content) {
  if (Array.isArray(elements)) {
    return elements.map(normalizeTrifoldElement).filter(Boolean);
  }
  return createPanelTextElements(panelId, title, content);
}

function createDefaultTrifold() {
  const panel = (id, title, content, theme) => ({
    title,
    content,
    theme,
    elements: createPanelTextElements(id, title, content)
  });
  return {
    title: "Mi tríptico",
    activePanel: "front",
    activeElementId: null,
    face: "exterior",
    design: "editorial",
    font: "dm-sans",
    panels: {
      back: panel("back", "Contraportada", "Nombre:\nMateria:\nGrupo:", "sky"),
      flap: panel("flap", "Información", "Escribe aquí una introducción o dato importante.", "mint"),
      front: panel("front", "Título del tríptico", "Agrega una imagen o presenta el tema principal.", "coral"),
      "inside-left": panel("inside-left", "¿Qué es?", "Explica el concepto principal con ideas breves.", "lavender"),
      "inside-center": panel("inside-center", "Características", "• Idea principal\n• Característica 1\n• Característica 2", "sun"),
      "inside-right": panel("inside-right", "Conclusión", "Resume lo más importante e incluye tus fuentes.", "mint")
    }
  };
}

function normalizeTrifoldElement(savedElement, index) {
  if (!savedElement || typeof savedElement !== "object") return null;
  const type = ["text", "image", "shape"].includes(savedElement.type) ? savedElement.type : null;
  if (!type) return null;
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  if (type === "image" && (typeof savedElement.src !== "string" || !savedElement.src.startsWith("data:image/"))) return null;
  return {
    id: typeof savedElement.id === "string" ? savedElement.id : `element-${Date.now()}-${index}`,
    type,
    text: typeof savedElement.text === "string" ? savedElement.text.slice(0, 500) : "Texto",
    src: type === "image" ? savedElement.src : "",
    alt: typeof savedElement.alt === "string" ? savedElement.alt.slice(0, 120) : "Imagen del tríptico",
    x: clamp(savedElement.x, 0, 1000, 35),
    y: clamp(savedElement.y, 0, 1000, 35),
    width: clamp(savedElement.width, 40, 1000, type === "text" ? 300 : 180),
    height: clamp(savedElement.height, 30, 1000, type === "text" ? 70 : 140),
    fontSize: clamp(savedElement.fontSize, 10, 100, 28),
    color: typeof savedElement.color === "string" ? savedElement.color : "#1f3029",
    background: typeof savedElement.background === "string" ? savedElement.background : "#ffffff",
    opacity: clamp(savedElement.opacity, .1, 1, .8),
    rotation: clamp(savedElement.rotation, -180, 180, 0),
    align: typeof savedElement.align === "string" ? savedElement.align : "left",
    field: savedElement.field === "title" || savedElement.field === "content" ? savedElement.field : ""
  };
}

function normalizeTrifold(savedTrifold) {
  const defaults = createDefaultTrifold();
  const source = savedTrifold && typeof savedTrifold === "object" ? savedTrifold : {};
  const face = source.face === "interior" ? "interior" : "exterior";
  const visiblePanels = trifoldFacePanels[face];
  const savedActivePanel = trifoldPanelIds.includes(source.activePanel) ? source.activePanel : "";
  const activePanel = visiblePanels.includes(savedActivePanel) ? savedActivePanel : visiblePanels[0];
  const savedPanels = source.panels && typeof source.panels === "object" ? source.panels : {};
  const panels = {};

  trifoldPanelIds.forEach((id) => {
    const defaultPanel = defaults.panels[id];
    const savedPanel = savedPanels[id] && typeof savedPanels[id] === "object" ? savedPanels[id] : {};
    const elements = Array.isArray(savedPanel.elements)
      ? savedPanel.elements.map(normalizeTrifoldElement).filter(Boolean)
      : createPanelTextElements(id, savedPanel.title || defaultPanel.title, savedPanel.content || defaultPanel.content);
    panels[id] = {
      title: typeof savedPanel.title === "string" ? savedPanel.title : defaultPanel.title,
      content: typeof savedPanel.content === "string" ? savedPanel.content : defaultPanel.content,
      theme: trifoldThemes.includes(savedPanel.theme) ? savedPanel.theme : defaultPanel.theme,
      elements
    };
  });

  return {
    ...defaults,
    ...source,
    title: typeof source.title === "string" ? source.title : defaults.title,
    face,
    activePanel,
    activeElementId: typeof source.activeElementId === "string" ? source.activeElementId : null,
    design: trifoldDesigns.includes(source.design) ? source.design : defaults.design,
    font: Object.prototype.hasOwnProperty.call(trifoldFonts, source.font) ? source.font : defaults.font,
    panels
  };
}

function createInitialState() {
  return {
    title: "Mi mapa conceptual",
    nodes: [],
    edges: [],
    layoutVersion: 2,
    layoutMode: "standard",
    mapTheme: "mint",
    mapFont: "dm-sans",
    snapToGrid: true,
    metadata: {
      subject: "",
      student: "",
      unit: "",
      activityNumber: "",
      activityName: "",
      bibliography: "",
      dueDate: ""
    },
    trifold: createDefaultTrifold(),
    tasks: [
      { id: "task-1", title: "Lectura: Ética y Justicia", subject: "Ética", category: "Lectura", dueDate: "Viernes", notes: "1. Sócrates y la virtud\n2. Platón y el alma\n3. Aristóteles y el justo medio\n4. Epicuro y la ataraxia", completed: false },
      { id: "task-2", title: "Tríptico de Investigación", subject: "Metodología", category: "Proyecto", dueDate: "Próxima semana", notes: "1. Resumen ejecutivo\n2. Metodología experimental\n3. Resultados\n4. Conclusiones", completed: false }
    ]
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) {
      const initialState = createInitialState();
      return {
        ...initialState,
        ...saved,
        layoutVersion: saved.layoutVersion || 0,
        mapTheme: mapThemes.includes(saved.mapTheme) ? saved.mapTheme : initialState.mapTheme,
        mapFont: Object.prototype.hasOwnProperty.call(trifoldFonts, saved.mapFont) ? saved.mapFont : initialState.mapFont,
        metadata: { ...initialState.metadata, ...(saved.metadata || {}) },
        trifold: normalizeTrifold(saved.trifold),
        tasks: Array.isArray(saved.tasks) ? saved.tasks : initialState.tasks
      };
    }
  } catch (error) {
    console.warn("No se pudo cargar el mapa guardado.", error);
  }
  return createInitialState();
}

function snapshotState() {
  return JSON.parse(JSON.stringify({
    title: state.title,
    nodes: state.nodes,
    edges: state.edges,
    layoutMode: state.layoutMode,
    layoutVersion: state.layoutVersion,
    mapTheme: state.mapTheme,
    mapFont: state.mapFont,
    snapToGrid: state.snapToGrid,
    metadata: state.metadata
  }));
}

function pushHistory() {
  undoStack.push(snapshotState());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  updateHistoryUI();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  const previous = undoStack.pop();
  Object.assign(state, previous);
  selectedNodeIds.clear();
  saveState();
  render();
  updateHistoryUI();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  const next = redoStack.pop();
  Object.assign(state, next);
  selectedNodeIds.clear();
  saveState();
  render();
  updateHistoryUI();
}

function updateHistoryUI() {
  const undoBtn = $("#undoButton");
  const redoBtn = $("#redoButton");
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function setZoom(level) {
  currentZoom = Math.min(2.0, Math.max(0.4, Math.round(level * 100) / 100));
  mapBoard.style.transform = `scale(${currentZoom})`;
  const label = $("#zoomLabel");
  if (label) label.textContent = `${Math.round(currentZoom * 100)}%`;
}

function zoomIn() {
  setZoom(currentZoom + 0.15);
}

function zoomOut() {
  setZoom(currentZoom - 0.15);
}

function resetZoom() {
  setZoom(1.0);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("No se pudo guardar el trabajo en este navegador.", error);
    if (error.name === "QuotaExceededError" || error.code === 22) {
      window.alert("⚠️ El almacenamiento del navegador está lleno. Si subiste imágenes muy pesadas, elimina alguna para poder guardar.");
    }
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEthicsNode(id, title, content, role, parentId = null) {
  return { id, title, content, role, parentId, x: 0, y: 0 };
}

function loadEthicsMap() {
  if (state.nodes.length && !window.confirm("Esto reemplazará el mapa actual por el mapa de ética. ¿Continuar?")) return;
  pushHistory();
  state.title = "ÉTICA";
  state.layoutMode = "ethics";
  state.nodes = [
    makeEthicsNode("socrates", "SÓCRATES", "conocimiento y virtud", "philosopher"),
    makeEthicsNode("plato", "PLATÓN", "razón y justicia", "philosopher"),
    makeEthicsNode("aristotle", "ARISTÓTELES", "felicidad y virtud", "philosopher"),
    makeEthicsNode("epicurus", "EPICURO", "placer y tranquilidad", "philosopher"),

    makeEthicsNode("socrates-knowledge", "CONOCIMIENTO", "conduce al bien", "branch", "socrates"),
    makeEthicsNode("socrates-self", "AUTOCONOCIMIENTO", "examina la vida", "branch", "socrates"),
    makeEthicsNode("socrates-virtue", "VIRTUD", "fortaleza · templanza · justicia", "branch", "socrates"),
    makeEthicsNode("socrates-personal", "SER JUSTO", "actuar correctamente", "branch", "socrates"),

    makeEthicsNode("plato-soul", "ALMA", "razón · valentía · deseos", "branch", "plato"),
    makeEthicsNode("plato-reason", "RAZÓN", "controla los deseos", "branch", "plato"),
    makeEthicsNode("plato-justice", "JUSTICIA", "ordena y armoniza", "branch", "plato"),
    makeEthicsNode("plato-personal", "EQUILIBRIO", "pensamiento · deseo · acción", "branch", "plato"),

    makeEthicsNode("aristotle-happiness", "FELICIDAD", "finalidad de la vida", "branch", "aristotle"),
    makeEthicsNode("aristotle-virtue", "VIRTUD", "se forma con hábitos", "branch", "aristotle"),
    makeEthicsNode("aristotle-mean", "JUSTO MEDIO", "evita los extremos", "branch", "aristotle"),
    makeEthicsNode("aristotle-personal", "RAZÓN", "guía las decisiones", "branch", "aristotle"),

    makeEthicsNode("epicurus-pleasure", "PLACER", "quita el dolor", "branch", "epicurus"),
    makeEthicsNode("epicurus-moderation", "MODERACIÓN", "evita los excesos", "branch", "epicurus"),
    makeEthicsNode("epicurus-ataraxia", "ATARAXIA", "tranquilidad mental", "branch", "epicurus"),
    makeEthicsNode("epicurus-personal", "VIDA SENCILLA", "amistad y calma", "branch", "epicurus")
  ];
  state.edges = [
    { from: "socrates", to: "socrates-knowledge", label: "se alcanza mediante" },
    { from: "socrates", to: "socrates-self", label: "requiere" },
    { from: "socrates", to: "socrates-virtue", label: "cultiva" },
    { from: "socrates", to: "socrates-personal", label: "implica" },
    { from: "plato", to: "plato-soul", label: "analiza" },
    { from: "plato", to: "plato-reason", label: "prioriza" },
    { from: "plato", to: "plato-justice", label: "busca" },
    { from: "plato", to: "plato-personal", label: "integra" },
    { from: "aristotle", to: "aristotle-happiness", label: "busca" },
    { from: "aristotle", to: "aristotle-virtue", label: "desarrolla mediante" },
    { from: "aristotle", to: "aristotle-mean", label: "encuentra en" },
    { from: "aristotle", to: "aristotle-personal", label: "usa" },
    { from: "epicurus", to: "epicurus-pleasure", label: "busca" },
    { from: "epicurus", to: "epicurus-moderation", label: "aplica" },
    { from: "epicurus", to: "epicurus-ataraxia", label: "alcanza" },
    { from: "epicurus", to: "epicurus-personal", label: "valora" }
  ];
  state.metadata = {
    subject: "Ética",
    student: "",
    unit: "",
    activityNumber: "",
    activityName: "Mapa conceptual: La ética",
    bibliography: "Apuntes de clase e investigación personal",
    dueDate: ""
  };
  state.layoutVersion = 2;
  arrangeEthicsNodes();
}

function loadSeparatedEthicsMap(mapTitle, sourceName, philosophers) {
  if (state.nodes.length && !window.confirm(`Esto reemplazará el mapa actual por «${mapTitle}». ¿Continuar?`)) return;
  pushHistory();
  state.title = mapTitle;
  state.layoutMode = "ethics";
  state.nodes = [];
  state.edges = [];

  philosophers.forEach((philosopher) => {
    state.nodes.push(makeEthicsNode(philosopher.id, philosopher.title, philosopher.summary, "philosopher"));
    philosopher.concepts.forEach((concept) => {
      const conceptId = `${philosopher.id}-${concept.id}`;
      state.nodes.push(makeEthicsNode(conceptId, concept.title, concept.content, "branch", philosopher.id));
      state.edges.push({ from: philosopher.id, to: conceptId, label: concept.label });
    });
  });

  state.metadata = {
    subject: "Ética",
    student: "",
    unit: "",
    activityNumber: "",
    activityName: mapTitle,
    bibliography: sourceName,
    dueDate: ""
  };
  state.layoutVersion = 2;
  arrangeEthicsNodes();
}

function loadClassMap() {
  loadSeparatedEthicsMap("ÉTICA · LO VISTO EN CLASE", "Apuntes y fotografía de clase", [
    {
      id: "socrates", title: "SÓCRATES", summary: "conocimiento y vida justa", concepts: [
        { id: "good", title: "BIEN Y MAL", content: "distinguir para actuar", label: "enseña a distinguir" },
        { id: "knowledge", title: "CONOCIMIENTO", content: "ayuda a actuar bien", label: "conduce a" },
        { id: "self", title: "AUTOCONOCIMIENTO", content: "examinar la propia vida", label: "requiere" },
        { id: "question", title: "CUESTIONAMIENTO", content: "preguntar antes de aceptar", label: "se practica mediante" },
        { id: "method", title: "MÉTODO SOCRÁTICO", content: "pregunta y diálogo", label: "se aplica con" },
        { id: "maieutics", title: "MAYÉUTICA", content: "ayudar a descubrir la verdad", label: "incluye" },
        { id: "ignorance", title: "IGNORANCIA", content: "reconocer lo que no se sabe", label: "parte de" },
        { id: "virtues", title: "VIRTUDES", content: "fortaleza · templanza · justicia", label: "cultiva" },
        { id: "justice", title: "VIDA JUSTA", content: "ser bueno antes que famoso", label: "prioriza" },
        { id: "good-life", title: "VIDA BUENA", content: "actuar con justicia", label: "busca" }
      ]
    },
    {
      id: "plato", title: "PLATÓN", summary: "razón, alma y justicia", concepts: [
        { id: "soul", title: "ALMA", content: "razón · valentía · deseos", label: "se compone de" },
        { id: "parts", title: "PARTES DEL ALMA", content: "racional · irascible · concupiscible", label: "se divide en" },
        { id: "reason", title: "RAZÓN", content: "saber y prudencia", label: "debe gobernar" },
        { id: "desires", title: "DESEOS", content: "parte concupiscible", label: "debe controlar" },
        { id: "justice", title: "JUSTICIA", content: "orden y armonía", label: "produce" },
        { id: "virtues", title: "VIRTUDES", content: "sabiduría · valentía · templanza", label: "desarrolla" },
        { id: "harmony", title: "ARMONÍA", content: "equilibrio entre las partes", label: "organiza" },
        { id: "influence", title: "SÓCRATES", content: "influye en su pensamiento", label: "recibe influencia de" },
        { id: "balance", title: "PERSONA ÉTICA", content: "gobierna y armoniza su alma", label: "se logra cuando" }
      ]
    },
    {
      id: "aristotle", title: "ARISTÓTELES", summary: "felicidad y vida buena", concepts: [
        { id: "goal", title: "OBJETIVO DE VIDA", content: "alcanzar la felicidad", label: "tiene como fin" },
        { id: "pleasure", title: "PLACER Y DIVERSIÓN", content: "disfrutar sin excesos", label: "incluye" },
        { id: "virtues", title: "VIRTUDES", content: "se desarrollan practicando", label: "requieren" },
        { id: "habits", title: "PRÁCTICA Y HÁBITOS", content: "forman el carácter", label: "se logran con" },
        { id: "reason", title: "CAPACIDADES RACIONALES", content: "guían las decisiones", label: "también desarrolla" },
        { id: "mean", title: "JUSTO MEDIO", content: "evita los extremos", label: "busca" },
        { id: "extremes", title: "EXTREMOS", content: "cobardía · temeridad", label: "se ubica entre" },
        { id: "adaptation", title: "SITUACIÓN", content: "lo correcto se adapta al contexto", label: "debe considerar" }
      ]
    },
    {
      id: "epicurus", title: "EPICURO", summary: "placer, dolor y tranquilidad", concepts: [
        { id: "goal", title: "OBJETIVO", content: "alcanzar la felicidad", label: "tiene como fin" },
        { id: "pleasure", title: "PLACER", content: "produce bienestar", label: "busca" },
        { id: "pain", title: "DOLOR", content: "debe disminuirse", label: "procura quitar" },
        { id: "moderation", title: "MODERACIÓN", content: "placer racional", label: "exige" },
        { id: "greater", title: "DOLOR PRESENTE", content: "puede traer placer mayor", label: "a veces acepta" },
        { id: "ataraxia", title: "ATARAXIA", content: "tranquilidad mental", label: "alcanza" },
        { id: "soul", title: "PLACERES DEL ALMA", content: "superan los excesos corporales", label: "prioriza" },
        { id: "simple", title: "VIDA SENCILLA", content: "amistad y calma", label: "prefiere" }
      ]
    }
  ]);
}

function loadPersonalMap() {
  loadSeparatedEthicsMap("ÉTICA · LO QUE YO LLEVÉ", "Resumen e investigación personal", [
    {
      id: "socrates", title: "SÓCRATES", summary: "actuar bien y ser justo", concepts: [
        { id: "good", title: "BIEN Y MAL", content: "distinguir antes de actuar", label: "consiste en distinguir" },
        { id: "correct", title: "ACTUAR CORRECTAMENTE", content: "pensar antes de actuar", label: "lleva a" },
        { id: "question", title: "CUESTIONARSE", content: "reflexionar sobre las acciones", label: "requiere" },
        { id: "justice", title: "SER JUSTO", content: "más importante que dinero o fama", label: "valora" },
        { id: "good-life", title: "BUENA PERSONA", content: "vivir con responsabilidad", label: "busca formar" }
      ]
    },
    {
      id: "plato", title: "PLATÓN", summary: "razón y control de deseos", concepts: [
        { id: "reason", title: "RAZÓN", content: "guía la conducta", label: "consiste en vivir según" },
        { id: "desires", title: "DESEOS", content: "deben ser controlados", label: "regula" },
        { id: "justice", title: "JUSTICIA", content: "orienta las acciones", label: "busca" },
        { id: "virtues", title: "VIRTUDES", content: "sabiduría · valentía · templanza", label: "desarrolla" },
        { id: "balance", title: "EQUILIBRIO", content: "pensamientos · deseos · acciones", label: "mantiene" }
      ]
    },
    {
      id: "aristotle", title: "ARISTÓTELES", summary: "felicidad mediante la virtud", concepts: [
        { id: "correct", title: "ACTUAR BIEN", content: "aprender a decidir", label: "consiste en" },
        { id: "habits", title: "BUENOS HÁBITOS", content: "práctica constante", label: "se desarrolla con" },
        { id: "happiness", title: "FELICIDAD", content: "resultado de una vida buena", label: "busca alcanzar" },
        { id: "virtues", title: "VIRTUDES", content: "orientan la conducta", label: "se practican para formar" },
        { id: "balance", title: "EQUILIBRIO", content: "evitar los extremos", label: "requiere" },
        { id: "reason", title: "RAZÓN", content: "permite tomar decisiones", label: "utiliza" }
      ]
    },
    {
      id: "epicurus", title: "EPICURO", summary: "felicidad tranquila", concepts: [
        { id: "happiness", title: "FELICIDAD", content: "vivir tranquilamente", label: "consiste en buscar" },
        { id: "pleasure", title: "PLACER", content: "disfrutar lo que hace bien", label: "incluye" },
        { id: "pain", title: "EVITAR EL DOLOR", content: "reducir sufrimientos", label: "procura" },
        { id: "moderation", title: "MODERACIÓN", content: "no desear demasiado", label: "exige" },
        { id: "simple", title: "COSAS SENCILLAS", content: "disfrutar sin excesos", label: "valora" },
        { id: "friendship", title: "AMISTAD", content: "acompaña una vida buena", label: "incluye" },
        { id: "tranquility", title: "TRANQUILIDAD", content: "evitar preocupaciones", label: "prioriza" }
      ]
    }
  ]);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function renderMapTheme() {
  if (!mapThemeSelect) return;
  mapThemeSelect.value = mapThemes.includes(state.mapTheme) ? state.mapTheme : "mint";
  mapFontSelect.value = Object.prototype.hasOwnProperty.call(trifoldFonts, state.mapFont) ? state.mapFont : "dm-sans";
  mapBoard.classList.remove(...mapThemes.map((theme) => `map-style-${theme}`));
  mapBoard.classList.add(`map-style-${state.mapTheme}`);
  mapBoard.style.setProperty("--map-font", trifoldFonts[state.mapFont] || trifoldFonts["dm-sans"]);
}

function render() {
  renderMapTheme();
  titleInput.value = state.title;
  mapTitleDisplay.textContent = state.title || "Mi mapa conceptual";
  renderMetadataForm();
  renderMetadataCard();
  renderTrifold();
  $("#nodeCount").textContent = `${state.nodes.length} ${state.nodes.length === 1 ? "concepto" : "conceptos"}`;
  $("#selectionCount").textContent = `${selectedNodeIds.size} seleccionados`;
  emptyState.style.display = state.nodes.length ? "none" : "block";
  renderSelects();
  renderNodes();
  renderConnections();
  updateHistoryUI();
}

function renderMetadataForm() {
  metadataFields.forEach((field) => {
    const input = document.querySelector(`[data-metadata-field="${field}"]`);
    if (input && document.activeElement !== input) input.value = state.metadata[field] || "";
  });
}

function renderMetadataCard() {
  const labels = {
    subject: "metadataSubject",
    student: "metadataStudent",
    unit: "metadataUnit",
    activityNumber: "metadataActivityNumber",
    activityName: "metadataActivityName",
    bibliography: "metadataBibliography",
    dueDate: "metadataDueDate"
  };
  Object.entries(labels).forEach(([field, elementId]) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = state.metadata[field] || "—";
  });
}

function renderSelects() {
  const currentSource = sourceSelect.value;
  const currentTarget = targetSelect.value;
  const options = state.nodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.title)}</option>`).join("");
  sourceSelect.innerHTML = `<option value="">Concepto de origen</option>${options}`;
  targetSelect.innerHTML = `<option value="">Concepto relacionado</option>${options}`;
  sourceSelect.value = state.nodes.some((node) => node.id === currentSource) ? currentSource : "";
  targetSelect.value = state.nodes.some((node) => node.id === currentTarget) ? currentTarget : "";
}

function getRootPosition() {
  if (state.layoutMode === "ethics") return { x: 870, y: 30 };
  const boardWidth = Math.max(mapBoard.clientWidth, BOARD_WIDTH);
  return { x: Math.max(20, (boardWidth - ROOT_WIDTH) / 2), y: 30 };
}

function toggleNodeSelection(id, additive = true) {
  if (additive) {
    if (selectedNodeIds.has(id)) selectedNodeIds.delete(id);
    else selectedNodeIds.add(id);
  } else {
    selectedNodeIds = new Set([id]);
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedNodeIds.size;
  const countElement = $("#selectionCount");
  if (countElement) countElement.textContent = `${count} seleccionados`;
  const selectedNodes = state.nodes.filter((node) => selectedNodeIds.has(node.id));
  const lockButton = $("#lockButton");
  if (lockButton) lockButton.textContent = selectedNodes.length && selectedNodes.every((node) => node.locked) ? "Desbloquear" : "Bloquear";
  const snapButton = $("#snapButton");
  if (snapButton) snapButton.textContent = `Ajuste: ${state.snapToGrid === false ? "OFF" : "ON"}`;
}

function renderNodes() {
  mapNodes.innerHTML = "";
  if (state.nodes.length) {
    const rootCard = document.createElement("article");
    const rootPosition = getRootPosition();
    rootCard.className = "concept-node root-node";
    rootCard.dataset.id = ROOT_ID;
    rootCard.style.left = `${rootPosition.x}px`;
    rootCard.style.top = `${rootPosition.y}px`;
    const rootHeading = document.createElement("h2");
    rootHeading.className = "node-title";
    rootHeading.textContent = state.title || "Mi mapa conceptual";
    rootCard.appendChild(rootHeading);
    mapNodes.appendChild(rootCard);
  }

  state.nodes.forEach((node) => {
    const card = document.createElement("article");
    const roleClass = node.role ? `${node.role}-node` : "";
    const selectedClass = selectedNodeIds.has(node.id) ? " selected" : "";
    const lockedClass = node.locked ? " locked" : "";
    card.className = `concept-node ${roleClass}${selectedClass}${lockedClass}`;
    card.dataset.id = node.id;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;

    const actions = document.createElement("div");
    actions.className = "node-actions";
    const editButton = document.createElement("button");
    editButton.className = "node-action";
    editButton.type = "button";
    editButton.title = "Editar nodo";
    editButton.textContent = "✎";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      editNode(node.id);
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "node-action";
    deleteButton.type = "button";
    deleteButton.title = "Eliminar nodo";
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteNode(node.id);
    });
    actions.append(editButton, deleteButton);

    const heading = document.createElement("h3");
    heading.className = "node-title";
    heading.textContent = node.title;
    const content = document.createElement("p");
    content.className = "node-content";
    content.textContent = node.content || "Sin descripción";
    card.append(actions, heading, content);
    card.addEventListener("click", (event) => {
      if (suppressNextNodeClick) {
        suppressNextNodeClick = false;
        return;
      }
      if (event.target.closest("button")) return;
      toggleNodeSelection(node.id, event.ctrlKey || event.metaKey || event.shiftKey);
      renderNodes();
    });
    card.addEventListener("pointerdown", (event) => startDragging(event, node));
    mapNodes.appendChild(card);
  });
  updateSelectionUI();
  renderConnections();
}

function renderConnections() {
  const width = Math.max(mapBoard.clientWidth, BOARD_WIDTH);
  const height = Math.max(mapBoard.clientHeight, BOARD_HEIGHT);
  connections.setAttribute("viewBox", `0 0 ${width} ${height}`);
  connectionLabels.setAttribute("viewBox", `0 0 ${width} ${height}`);
  connections.innerHTML = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#9fb7ae"></path></marker></defs>`;
  connectionLabels.innerHTML = "";
  const addLabel = (text, x, y) => {
    if (!text) return;
    const labelText = String(text);
    const labelWidth = Math.max(52, labelText.length * 6.2 + 16);
    connectionLabels.insertAdjacentHTML("beforeend", `<rect class="edge-label-bg" x="${x - labelWidth / 2}" y="${y - 15}" width="${labelWidth}" height="20" rx="5"></rect><text class="edge-label-text" x="${x}" y="${y}">${escapeHtml(labelText)}</text>`);
  };
  const nodeWidth = (node) => node.role === "philosopher" ? 210 : NODE_WIDTH;
  const nodeHeight = (node) => node.role === "philosopher" ? 105 : NODE_HEIGHT;
  const effectiveEdges = [...state.edges];
  state.nodes.forEach((node) => {
    if (node.parentId && !effectiveEdges.some((edge) => edge.from === node.parentId && edge.to === node.id)) {
      effectiveEdges.push({ from: node.parentId, to: node.id, label: "" });
    }
  });
  const rootPosition = getRootPosition();
  let rootNodes = state.nodes.filter((node) => !effectiveEdges.some((edge) => edge.to === node.id));
  if (!rootNodes.length && state.nodes.length) rootNodes = [state.nodes[0]];
  rootNodes.forEach((node) => {
    const startX = rootPosition.x + ROOT_WIDTH / 2;
    const startY = rootPosition.y + ROOT_HEIGHT;
    const endX = node.x + nodeWidth(node) / 2;
    const endY = node.y;
    connections.insertAdjacentHTML("beforeend", `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" marker-end="url(#arrow)"></line>`);
    addLabel("se analiza mediante", (startX + endX) / 2, (startY + endY) / 2 - 8);
  });

  const groupedEthicsEdges = new Set();
  if (state.nodes.some((node) => node.role === "philosopher")) {
    const groups = new Map();
    effectiveEdges.forEach((edge) => {
      const from = state.nodes.find((node) => node.id === edge.from);
      const to = state.nodes.find((node) => node.id === edge.to);
      if (!from || !to || from.role !== "philosopher") return;
      if (!groups.has(from.id)) groups.set(from.id, { from, edges: [] });
      groups.get(from.id).edges.push({ edge, to });
      groupedEthicsEdges.add(edge);
    });

    groups.forEach(({ from, edges }) => {
      const fromWidth = nodeWidth(from);
      const fromHeight = nodeHeight(from);
      const startX = from.x + fromWidth / 2;
      const startY = from.y + fromHeight;
      const rows = new Map();
      edges.forEach((entry, index) => {
        const row = Math.floor(index / 2);
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(entry);
      });
      const branchRows = [...rows.entries()].map(([row, entries]) => ({
        row,
        entries,
        y: entries[0].to.y - 25
      }));
      const lastBranchY = branchRows[branchRows.length - 1]?.y || startY + 25;
      connections.insertAdjacentHTML("beforeend", `<line x1="${startX}" y1="${startY}" x2="${startX}" y2="${lastBranchY}"></line>`);
      branchRows.forEach(({ entries, y }) => {
        const centers = entries.map(({ to }) => to.x + nodeWidth(to) / 2);
        const left = Math.min(startX, ...centers);
        const right = Math.max(startX, ...centers);
        connections.insertAdjacentHTML("beforeend", `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line>`);
        entries.forEach(({ edge, to }) => {
          const centerX = to.x + nodeWidth(to) / 2;
          connections.insertAdjacentHTML("beforeend", `<line x1="${centerX}" y1="${y}" x2="${centerX}" y2="${to.y}" marker-end="url(#arrow)"></line>`);
          addLabel(edge.label, centerX, y - 7);
        });
      });
    });
  }

  effectiveEdges.forEach((edge) => {
    if (groupedEthicsEdges.has(edge)) return;
    const from = state.nodes.find((node) => node.id === edge.from);
    const to = state.nodes.find((node) => node.id === edge.to);
    if (!from || !to) return;
    const fromWidth = nodeWidth(from);
    const toWidth = nodeWidth(to);
    const fromHeight = nodeHeight(from);
    const startX = from.x + fromWidth / 2;
    const startY = from.y + fromHeight;
    const endX = to.x + toWidth / 2;
    const endY = to.y;

    if (state.layoutMode === "ethics" && from.role === "philosopher") {
      const childCenterX = to.x + toWidth / 2;
      const startX = Math.min(Math.max(childCenterX, from.x + 24), from.x + fromWidth - 24);
      const bendY = startY + 22;
      const path = `M ${startX} ${startY} L ${startX} ${bendY} C ${startX} ${bendY + 18}, ${childCenterX} ${bendY + 18}, ${childCenterX} ${endY}`;
      connections.insertAdjacentHTML("beforeend", `<path d="${path}" marker-end="url(#arrow)"></path>`);
      addLabel(edge.label, childCenterX, (bendY + endY) / 2 - 8);
      return;
    }

    const dx = endX - (from.x + fromWidth / 2);
    const dy = endY - (from.y + fromHeight / 2);
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const offsetX = (dx / distance) * Math.min(fromWidth / 2 - 8, 84);
    const offsetY = (dy / distance) * Math.min(fromHeight / 2 - 8, 37);
    const lineStartX = from.x + fromWidth / 2 + offsetX;
    const lineStartY = from.y + fromHeight / 2 + offsetY;
    const lineEndX = to.x + toWidth / 2 - offsetX;
    const lineEndY = to.y + nodeHeight(to) / 2 - offsetY;
    connections.insertAdjacentHTML("beforeend", `<line x1="${lineStartX}" y1="${lineStartY}" x2="${lineEndX}" y2="${lineEndY}" marker-end="url(#arrow)"></line>`);
    addLabel(edge.label, (lineStartX + lineEndX) / 2, (lineStartY + lineEndY) / 2 - 8);
  });
}

function addNode(event) {
  event.preventDefault();
  const title = nodeTitleInput.value.trim();
  const content = nodeContentInput.value.trim();
  if (!title) return;
  pushHistory();
  const index = state.nodes.length;
  state.nodes.push({ id: createId(), title, content, x: 45 + (index % 3) * 260, y: 45 + Math.floor(index / 3) * 155 });
  selectedNodeIds = new Set([state.nodes[state.nodes.length - 1].id]);
  nodeForm.reset();
  state.layoutMode = "standard";
  state.layoutVersion = 0;
  arrangeNodes();
  nodeTitleInput.focus();
}

function editNode(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return;
  const title = window.prompt("Nombre del concepto:", node.title);
  if (title === null) return;
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const content = window.prompt("Descripción o información:", node.content || "");
  pushHistory();
  node.title = cleanTitle;
  if (content !== null) node.content = content.trim();
  saveState();
  render();
}

function deleteNode(id) {
  const node = state.nodes.find((item) => item.id === id);
  if (!node || !window.confirm(`¿Eliminar el concepto “${node.title}”?`)) return;
  pushHistory();
  state.nodes = state.nodes.filter((item) => item.id !== id);
  state.edges = state.edges.filter((edge) => edge.from !== id && edge.to !== id);
  selectedNodeIds.delete(id);
  saveState();
  render();
}

function connectNodes() {
  const from = sourceSelect.value;
  const to = targetSelect.value;
  if (!from || !to || from === to) {
    window.alert("Selecciona dos conceptos diferentes para conectarlos.");
    return;
  }
  const alreadyExists = state.edges.some((edge) => edge.from === from && edge.to === to);
  if (alreadyExists) {
    window.alert("Estos conceptos ya están conectados.");
    return;
  }
  pushHistory();
  state.edges.push({ from, to, label: relationInput.value.trim() });
  relationInput.value = "";
  state.layoutMode = "standard";
  state.layoutVersion = 0;
  arrangeNodes();
}

function arrangeEthicsNodes() {
  const philosophers = state.nodes.filter((node) => node.role === "philosopher");
  const boardWidth = 2400;
  const clusterStart = 50;
  const clusterStep = 500;
  const maxChildren = Math.max(0, ...philosophers.map((philosopher) => state.nodes.filter((node) => node.parentId === philosopher.id).length));
  const boardHeight = Math.max(720, 260 + Math.ceil(maxChildren / 2) * 155 + 70);
  mapBoard.style.minWidth = `${boardWidth}px`;
  mapBoard.style.minHeight = `${boardHeight}px`;
  philosophers.forEach((philosopher, index) => {
    const clusterX = clusterStart + index * clusterStep;
    if (!philosopher.locked) {
      philosopher.x = clusterX + 95;
      philosopher.y = 190;
    }
    const children = state.nodes.filter((node) => node.parentId === philosopher.id);
    children.forEach((child, childIndex) => {
      if (child.locked) return;
      child.x = clusterX + (childIndex % 2) * 210;
      child.y = 360 + Math.floor(childIndex / 2) * 155;
    });
  });
  state.layoutVersion = 4;
  saveState();
  render();
}

function arrangeNodes() {
  if (state.layoutMode === "ethics" || state.nodes.some((node) => node.role === "philosopher")) {
    state.layoutMode = "ethics";
    arrangeEthicsNodes();
    return;
  }
  state.layoutVersion = 2;
  const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
  state.edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1));
  const levels = [];
  const unresolved = new Set(state.nodes.map((node) => node.id));
  let roots = state.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  if (!roots.length) roots = [state.nodes[0].id];

  while (roots.length && unresolved.size) {
    levels.push(roots);
    roots.forEach((id) => unresolved.delete(id));
    const next = [];
    roots.forEach((id) => state.edges.filter((edge) => edge.from === id).forEach((edge) => {
      if (unresolved.has(edge.to) && !next.includes(edge.to)) next.push(edge.to);
    }));
    roots = next;
  }
  if (unresolved.size) levels.push([...unresolved]);

  const widestLevel = Math.max(...levels.map((level) => level.length));
  const layoutWidth = Math.max(BOARD_WIDTH, widestLevel * (NODE_WIDTH + 28) + 80);
  const firstRowY = 190;
  const rowGap = 150;
  mapBoard.style.minWidth = `${layoutWidth}px`;
  mapBoard.style.minHeight = `${Math.max(BOARD_HEIGHT, firstRowY + levels.length * rowGap + 70)}px`;

  levels.forEach((level, levelIndex) => {
    const totalWidth = level.length * NODE_WIDTH + (level.length - 1) * 28;
    const startX = Math.max(30, (layoutWidth - totalWidth) / 2);
    level.forEach((id, index) => {
      const node = state.nodes.find((item) => item.id === id);
      if (!node || node.locked) return;
      node.x = startX + index * (NODE_WIDTH + 28);
      node.y = firstRowY + levelIndex * rowGap;
    });
  });
  saveState();
  render();
}

function startDragging(event, node) {
  if (event.button !== 0 || event.target.closest("button") || node.locked) return;
  const additive = event.ctrlKey || event.metaKey || event.shiftKey;
  if (!selectedNodeIds.has(node.id)) {
    if (additive) selectedNodeIds.add(node.id);
    else selectedNodeIds = new Set([node.id]);
    updateSelectionUI();
  }
  const movableNodes = state.nodes.filter((item) => selectedNodeIds.has(item.id) && !item.locked);
  if (!movableNodes.length) return;
  const boardRect = mapBoard.getBoundingClientRect();
  dragData = {
    startX: (event.clientX - boardRect.left) / currentZoom,
    startY: (event.clientY - boardRect.top) / currentZoom,
    nodes: movableNodes.map((item) => ({ node: item, x: item.x, y: item.y })),
    initialNodes: movableNodes.map((item) => ({ id: item.id, x: item.x, y: item.y }))
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  document.addEventListener("pointermove", dragNode);
  document.addEventListener("pointerup", stopDragging, { once: true });
}

function dragNode(event) {
  if (!dragData) return;
  const rect = mapBoard.getBoundingClientRect();
  const currentPointerX = (event.clientX - rect.left) / currentZoom;
  const currentPointerY = (event.clientY - rect.top) / currentZoom;
  const deltaX = currentPointerX - dragData.startX;
  const deltaY = currentPointerY - dragData.startY;
  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) suppressNextNodeClick = true;
  const snap = (value) => state.snapToGrid === false ? value : Math.round(value / 20) * 20;
  const boardUnscaledWidth = mapBoard.offsetWidth || (rect.width / currentZoom);
  const boardUnscaledHeight = mapBoard.offsetHeight || (rect.height / currentZoom);
  dragData.nodes.forEach(({ node, x, y }) => {
    const width = node.role === "philosopher" ? 210 : NODE_WIDTH;
    node.x = Math.max(8, Math.min(boardUnscaledWidth - width - 8, snap(x + deltaX)));
    node.y = Math.max(8, Math.min(boardUnscaledHeight - NODE_HEIGHT - 8, snap(y + deltaY)));
    const card = mapNodes.querySelector(`[data-id="${node.id}"]`);
    if (card) {
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;
    }
  });
  renderConnections();
}

function stopDragging() {
  if (dragData) {
    const hasMoved = dragData.initialNodes && dragData.initialNodes.some((init) => {
      const current = state.nodes.find((n) => n.id === init.id);
      return current && (current.x !== init.x || current.y !== init.y);
    });
    if (hasMoved) {
      undoStack.push({
        ...snapshotState(),
        nodes: state.nodes.map((n) => {
          const init = dragData.initialNodes.find((i) => i.id === n.id);
          return init ? { ...n, x: init.x, y: init.y } : { ...n };
        })
      });
      if (undoStack.length > 40) undoStack.shift();
      redoStack.length = 0;
      updateHistoryUI();
    }
    saveState();
  }
  dragData = null;
  document.removeEventListener("pointermove", dragNode);
}

function startSelectionBox(event) {
  if (event.button !== 0 || event.target.closest(".concept-node") || event.target.closest("button")) return;
  const boardRect = mapBoard.getBoundingClientRect();
  const additive = event.ctrlKey || event.metaKey || event.shiftKey;
  if (!additive) selectedNodeIds.clear();
  selectionData = {
    startX: (event.clientX - boardRect.left) / currentZoom,
    startY: (event.clientY - boardRect.top) / currentZoom,
    additive
  };
  selectionBox.hidden = false;
  selectionBox.style.left = `${selectionData.startX}px`;
  selectionBox.style.top = `${selectionData.startY}px`;
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
  document.addEventListener("pointermove", updateSelectionBox);
  document.addEventListener("pointerup", finishSelectionBox, { once: true });
  updateSelectionUI();
}

function updateSelectionBox(event) {
  if (!selectionData) return;
  const boardRect = mapBoard.getBoundingClientRect();
  const currentX = (event.clientX - boardRect.left) / currentZoom;
  const currentY = (event.clientY - boardRect.top) / currentZoom;
  const left = Math.min(selectionData.startX, currentX);
  const top = Math.min(selectionData.startY, currentY);
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${Math.abs(currentX - selectionData.startX)}px`;
  selectionBox.style.height = `${Math.abs(currentY - selectionData.startY)}px`;
}

function finishSelectionBox(event) {
  if (!selectionData) return;
  const boardRect = mapBoard.getBoundingClientRect();
  const currentX = (event.clientX - boardRect.left) / currentZoom;
  const currentY = (event.clientY - boardRect.top) / currentZoom;
  const left = Math.min(selectionData.startX, currentX);
  const top = Math.min(selectionData.startY, currentY);
  const right = Math.max(selectionData.startX, currentX);
  const bottom = Math.max(selectionData.startY, currentY);
  if (right - left > 5 || bottom - top > 5) {
    state.nodes.forEach((node) => {
      const width = node.role === "philosopher" ? 210 : NODE_WIDTH;
      const height = NODE_HEIGHT;
      const intersects = node.x < right && node.x + width > left && node.y < bottom && node.y + height > top;
      if (intersects) selectedNodeIds.add(node.id);
    });
  }
  selectionBox.hidden = true;
  selectionData = null;
  document.removeEventListener("pointermove", updateSelectionBox);
  updateSelectionUI();
  renderNodes();
}

function toggleSnapToGrid() {
  state.snapToGrid = state.snapToGrid === false;
  saveState();
  updateSelectionUI();
}

function selectAllNodes() {
  selectedNodeIds = new Set(state.nodes.map((node) => node.id));
  renderNodes();
}

function duplicateSelected() {
  const selectedNodes = state.nodes.filter((node) => selectedNodeIds.has(node.id));
  if (!selectedNodes.length) return;
  pushHistory();
  const idMap = new Map(selectedNodes.map((node) => [node.id, createId()]));
  const copies = selectedNodes.map((node) => ({
    ...node,
    id: idMap.get(node.id),
    title: `${node.title} copia`,
    x: node.x + 35,
    y: node.y + 35,
    locked: false,
    parentId: idMap.get(node.parentId) || node.parentId
  }));
  const copiedEdges = state.edges.filter((edge) => idMap.has(edge.from) && idMap.has(edge.to)).map((edge) => ({
    ...edge,
    from: idMap.get(edge.from),
    to: idMap.get(edge.to)
  }));
  state.nodes.push(...copies);
  state.edges.push(...copiedEdges);
  state.layoutMode = "standard";
  state.layoutVersion = 0;
  selectedNodeIds = new Set(copies.map((node) => node.id));
  saveState();
  render();
}

function toggleLockSelected() {
  const selectedNodes = state.nodes.filter((node) => selectedNodeIds.has(node.id));
  if (!selectedNodes.length) return;
  pushHistory();
  const shouldLock = !selectedNodes.every((node) => node.locked);
  selectedNodes.forEach((node) => { node.locked = shouldLock; });
  saveState();
  renderNodes();
}

function deleteSelectedNodes(ask = true) {
  const ids = new Set(selectedNodeIds);
  if (!ids.size) return;
  if (ask && !window.confirm(`¿Eliminar ${ids.size} concepto${ids.size === 1 ? "" : "s"}?`)) return;
  pushHistory();
  state.nodes = state.nodes.filter((node) => !ids.has(node.id));
  state.edges = state.edges.filter((edge) => !ids.has(edge.from) && !ids.has(edge.to));
  selectedNodeIds.clear();
  saveState();
  render();
}

function clearMap() {
  if (!state.nodes.length || window.confirm("¿Quieres borrar todo el mapa?")) {
    pushHistory();
    Object.assign(state, createInitialState());
    selectedNodeIds.clear();
    mapBoard.style.minWidth = "820px";
    mapBoard.style.minHeight = `${BOARD_HEIGHT}px`;
    saveState();
    render();
  }
}

function restoreFocusMode() {
  document.body.classList.remove("focus-mode");
  const button = $("#fullscreenButton");
  if (button) button.textContent = "▣ Pantalla completa";
  requestAnimationFrame(() => {
    if (mapViewport) {
      mapViewport.scrollLeft = focusScroll.left;
      mapViewport.scrollTop = focusScroll.top;
    }
    renderNodes();
    renderConnections();
  });
}

async function toggleFocusMode() {
  const enabled = !document.body.classList.contains("focus-mode");
  if (enabled && mapViewport) {
    focusScroll = { left: mapViewport.scrollLeft, top: mapViewport.scrollTop };
  }
  document.body.classList.toggle("focus-mode", enabled);
  const button = $("#fullscreenButton");
  button.textContent = enabled ? "× Salir de pantalla completa" : "▣ Pantalla completa";
  if (enabled && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); } catch (error) { /* El modo visual sigue funcionando aunque el navegador lo rechace. */ }
  } else if (!enabled && document.fullscreenElement && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch (error) { /* No se requiere acción adicional. */ }
  }
  if (!enabled) {
    restoreFocusMode();
    return;
  }
  requestAnimationFrame(() => {
    renderNodes();
    renderConnections();
  });
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("focus-mode")) {
    restoreFocusMode();
  } else {
    requestAnimationFrame(renderConnections);
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isEditingField = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (isEditingField) return;
  if (document.body.classList.contains("trifold-mode")) {
    if ((event.key === "Delete" || event.key === "Backspace") && state.trifold.activeElementId) {
      event.preventDefault();
      deleteActiveTrifoldElement();
    } else if (event.key === "Escape" && state.trifold.activeElementId) {
      state.trifold.activeElementId = null;
      renderTrifoldPanels();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
    event.preventDefault();
    zoomIn();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "-") {
    event.preventDefault();
    zoomOut();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "0") {
    event.preventDefault();
    resetZoom();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllNodes();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeIds.size) {
    event.preventDefault();
    deleteSelectedNodes(true);
    return;
  }
  if (event.key === "Escape") {
    if (document.body.classList.contains("focus-mode") && !document.fullscreenElement) {
      restoreFocusMode();
    }
    if (selectedNodeIds.size) {
      selectedNodeIds.clear();
      renderNodes();
    }
  }
});


