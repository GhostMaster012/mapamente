const OPENAI_KEY_STORAGE = "mapamente_openai_key";
const OPENAI_PIN_STORAGE = "mapamente_ai_pin";
const OPENAI_MODEL_STORAGE = "mapamente_openai_model";

function getStoredApiKey() {
  return localStorage.getItem(OPENAI_KEY_STORAGE) || "";
}

function getStoredPin() {
  return localStorage.getItem(OPENAI_PIN_STORAGE) || "";
}

function getStoredModel() {
  return localStorage.getItem(OPENAI_MODEL_STORAGE) || "gpt-4o-mini";
}

function saveAiSettings(apiKey, pin, model) {
  if (apiKey) localStorage.setItem(OPENAI_KEY_STORAGE, apiKey.trim());
  else localStorage.removeItem(OPENAI_KEY_STORAGE);

  if (pin) localStorage.setItem(OPENAI_PIN_STORAGE, pin.trim());
  else localStorage.removeItem(OPENAI_PIN_STORAGE);

  if (model) localStorage.setItem(OPENAI_MODEL_STORAGE, model);
}

function checkPinAccess() {
  const pin = getStoredPin();
  if (!pin) return true;
  const entered = window.prompt("🔒 Esta función está protegida con contraseña/PIN. Ingresa tu PIN:");
  if (entered === null) return false;
  if (entered.trim() === pin) return true;
  window.alert("❌ PIN incorrecto.");
  return false;
}

async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    openAiModal("settings");
    throw new Error("Por favor ingresa tu API Key de OpenAI para continuar.");
  }

  const model = getStoredModel();
  const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");

  const bodyPayload = {
    model,
    messages: [
      { role: isReasoningModel ? "developer" : "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  };

  let response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const rawMsg = errorData.error?.message || "";

    // Retry with single user message fallback if response_format or role had an issue
    if (rawMsg.includes("response_format") || rawMsg.includes("developer") || rawMsg.includes("system") || rawMsg.includes("temperature")) {
      const fallbackPayload = {
        model,
        messages: [
          { role: "user", content: `${systemPrompt}\n\nIMPORTANTE: Responde únicamente con el JSON solicitado sin texto adicional.\n\nContenido:\n${userPrompt}` }
        ]
      };
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(fallbackPayload)
      });
    }

    if (!response.ok) {
      const retryError = await response.json().catch(() => ({}));
      const message = retryError.error?.message || rawMsg || `Error ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI API Error: ${message}`);
    }
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("No se recibió respuesta de OpenAI.");

  try {
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawContent];
    const cleanJson = (jsonMatch[1] || rawContent).trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Error parseando respuesta JSON:", rawContent);
    throw new Error("La IA no devolvió un formato JSON válido. Intenta nuevamente.");
  }
}

async function generateMapWithAi(topicOrText) {
  if (!checkPinAccess()) return;
  const systemPrompt = `Eres un asistente universitario experto en pedagogía y mapas conceptuales.
Tu tarea es estructurar un mapa conceptual claro, sintético y jerárquico a partir del tema o texto proporcionado.
Debes responder ÚNICAMENTE con un objeto JSON con este formato exacto:
{
  "title": "TÍTULO PRINCIPAL EN MAYÚSCULAS",
  "subject": "Materia relacionada (opcional)",
  "nodes": [
    { "id": "1", "title": "Concepto Raíz", "content": "Breve explicación (máx 15 palabras)" },
    { "id": "2", "title": "Subconcepto A", "content": "Detalle o ejemplo" },
    { "id": "3", "title": "Subconcepto B", "content": "Detalle o ejemplo" }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "se divide en" },
    { "from": "1", "to": "3", "label": "produce" }
  ]
}
Genera entre 4 y 10 conceptos concisos y conexiones con conectores claros (ej. "se compone de", "requiere", "permite", "conduce a").`;

  const result = await callOpenAI(systemPrompt, topicOrText);

  if (!result.nodes || !Array.isArray(result.nodes) || !result.nodes.length) {
    throw new Error("El formato del mapa generado no es válido.");
  }

  pushHistory();
  state.title = result.title || "MAPA GENERADO";
  state.layoutMode = "standard";
  state.layoutVersion = 0;
  if (result.subject) state.metadata.subject = result.subject;

  state.nodes = result.nodes.map((node, index) => ({
    id: String(node.id || createId()),
    title: String(node.title || `Concepto ${index + 1}`),
    content: String(node.content || ""),
    x: 60 + (index % 3) * 240,
    y: 60 + Math.floor(index / 3) * 150
  }));

  state.edges = Array.isArray(result.edges) ? result.edges.map((edge) => ({
    from: String(edge.from),
    to: String(edge.to),
    label: String(edge.label || "conecta con")
  })) : [];

  arrangeNodes();
  saveState();
  switchToWorkspace("map");
}

async function generateTrifoldWithAi(topicOrText) {
  if (!checkPinAccess()) return;
  const systemPrompt = `Eres un diseñador editorial y redactor académico experto en trípticos universitarios.
Tu objetivo es redactar el contenido completo de los 6 paneles de un tríptico para doblar en 3 partes.
Debes responder ÚNICAMENTE con un objeto JSON con este formato exacto:
{
  "title": "Título del tríptico",
  "design": "editorial",
  "font": "poppins",
  "panels": {
    "front": {
      "title": "TÍTULO PRINCIPAL",
      "content": "Subtítulo o presentación del tema\\n\\nNombre del Alumno / Materia"
    },
    "flap": {
      "title": "RESUMEN / INTRODUCCIÓN",
      "content": "Puntos clave y justificación del tema..."
    },
    "back": {
      "title": "FUENTES Y CONTACTO",
      "content": "• Bibliografía en formato APA\\n• Datos de contacto y conclusión breve"
    },
    "inside-left": {
      "title": "1. CONTEXTO Y ANTECEDENTES",
      "content": "Explicación del problema o marco teórico..."
    },
    "inside-center": {
      "title": "2. DESARROLLO Y ANÁLISIS",
      "content": "• Punto clave 1\\n• Punto clave 2\\n• Características principales"
    },
    "inside-right": {
      "title": "3. CONCLUSIONES E IMPACTO",
      "content": "Síntesis final, reflexiones y recomendaciones..."
    }
  }
}`;

  const result = await callOpenAI(systemPrompt, topicOrText);

  if (!result.panels || typeof result.panels !== "object") {
    throw new Error("El formato del tríptico generado no es válido.");
  }

  state.trifold.title = result.title || "Tríptico Académico";
  if (result.design && trifoldDesigns.includes(result.design)) state.trifold.design = result.design;
  if (result.font && Object.prototype.hasOwnProperty.call(trifoldFonts, result.font)) state.trifold.font = result.font;
  state.trifold.face = "exterior";
  state.trifold.activePanel = "front";
  state.trifold.activeElementId = null;

  trifoldPanelIds.forEach((id) => {
    const pData = result.panels[id];
    if (!pData) return;
    const panel = state.trifold.panels[id];
    panel.title = pData.title || panel.title;
    panel.content = pData.content || panel.content;
    panel.elements = createPanelTextElements(id, panel.title, panel.content);
  });

  renderTrifold();
  saveState();
  switchToWorkspace("trifold");
}

async function generateTasksWithAi(promptText) {
  if (!checkPinAccess()) return;
  const systemPrompt = `Eres un asistente universitario que organiza tareas y apuntes.
Analiza el texto o consigna del usuario y extrae tareas organizadas.
Responde ÚNICAMENTE con un JSON con este formato:
{
  "tasks": [
    {
      "title": "Título de la tarea o apunte",
      "subject": "Materia detectada",
      "category": "Tarea",
      "dueDate": "Fecha o plazo sugerido",
      "notes": "1. Paso 1\\n2. Paso 2\\n3. Paso 3"
    }
  ]
}
Las categorías válidas son: "Tarea", "Lectura", "Proyecto", "Examen", "Apunte".`;

  const result = await callOpenAI(systemPrompt, promptText);

  if (!result.tasks || !Array.isArray(result.tasks)) {
    throw new Error("No se pudieron extraer tareas.");
  }

  const tasks = getTasks();
  result.tasks.forEach((t) => {
    tasks.unshift({
      id: createId(),
      title: t.title || "Nueva tarea",
      subject: t.subject || "",
      category: t.category || "Tarea",
      dueDate: t.dueDate || "",
      notes: t.notes || "",
      completed: false
    });
  });

  saveState();
  renderTasks();
  switchToWorkspace("tasks");
}

function openAiModal(tab = "map") {
  const modal = document.getElementById("aiModal");
  if (!modal) return;
  modal.hidden = false;

  const apiKeyInput = document.getElementById("aiApiKeyInput");
  const pinInput = document.getElementById("aiPinInput");
  const modelSelect = document.getElementById("aiModelSelect");
  const customContainer = document.getElementById("aiCustomModelContainer");
  const customInput = document.getElementById("aiCustomModelInput");

  if (apiKeyInput) apiKeyInput.value = getStoredApiKey();
  if (pinInput) pinInput.value = getStoredPin();

  const storedModel = getStoredModel();
  if (modelSelect) {
    const optionExists = Array.from(modelSelect.options).some((opt) => opt.value === storedModel);
    if (optionExists) {
      modelSelect.value = storedModel;
      if (customContainer) customContainer.hidden = true;
    } else {
      modelSelect.value = "custom";
      if (customContainer) customContainer.hidden = false;
      if (customInput) customInput.value = storedModel;
    }
  }

  switchAiTab(tab);
}

function closeAiModal() {
  const modal = document.getElementById("aiModal");
  if (modal) modal.hidden = true;
}

function switchAiTab(tabName) {
  document.querySelectorAll(".ai-tab-button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.aiTab === tabName);
  });
  document.querySelectorAll(".ai-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.aiTab !== tabName;
  });
}

document.getElementById("aiModelSelect")?.addEventListener("change", (e) => {
  const customContainer = document.getElementById("aiCustomModelContainer");
  if (customContainer) customContainer.hidden = e.target.value !== "custom";
});
