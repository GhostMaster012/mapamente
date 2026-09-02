titleInput.addEventListener("input", () => {
  state.title = titleInput.value;
  saveState();
});

trifoldTitleInput.addEventListener("input", () => {
  state.trifold.title = trifoldTitleInput.value;
  trifoldTitleDisplay.textContent = state.trifold.title || "Mi tríptico";
  saveState();
});

trifoldPanelSelect.addEventListener("change", () => {
  const nextPanel = trifoldPanelSelect.value;
  state.trifold.activePanel = trifoldPanelIds.includes(nextPanel) ? nextPanel : "front";
  state.trifold.activeElementId = null;
  state.trifold.face = trifoldFacePanels.interior.includes(state.trifold.activePanel) ? "interior" : "exterior";
  renderTrifold();
  saveState();
});

trifoldPanelTitle.addEventListener("input", () => {
  const panel = getTrifoldPanel(state.trifold.activePanel);
  panel.title = trifoldPanelTitle.value.slice(0, 70);
  const titleElement = panel.elements.find((element) => element.field === "title");
  if (titleElement) titleElement.text = panel.title;
  renderTrifoldPanels();
  saveState();
});

trifoldPanelContent.addEventListener("input", () => {
  const panel = getTrifoldPanel(state.trifold.activePanel);
  panel.content = trifoldPanelContent.value.slice(0, 1200);
  const contentElement = panel.elements.find((element) => element.field === "content");
  if (contentElement) contentElement.text = panel.content;
  renderTrifoldPanels();
  saveState();
});

trifoldPanelTheme.addEventListener("change", () => {
  getTrifoldPanel(state.trifold.activePanel).theme = trifoldPanelTheme.value;
  renderTrifoldPanels();
  saveState();
});

trifoldDesignSelect.addEventListener("change", () => {
  state.trifold.design = trifoldDesigns.includes(trifoldDesignSelect.value) ? trifoldDesignSelect.value : "editorial";
  renderTrifold();
  saveState();
});

trifoldFontSelect.addEventListener("change", () => {
  state.trifold.font = Object.prototype.hasOwnProperty.call(trifoldFonts, trifoldFontSelect.value) ? trifoldFontSelect.value : "dm-sans";
  renderTrifold();
  saveState();
});

mapThemeSelect.addEventListener("change", () => {
  state.mapTheme = mapThemes.includes(mapThemeSelect.value) ? mapThemeSelect.value : "mint";
  renderMapTheme();
  saveState();
});

mapFontSelect.addEventListener("change", () => {
  state.mapFont = Object.prototype.hasOwnProperty.call(trifoldFonts, mapFontSelect.value) ? mapFontSelect.value : "dm-sans";
  renderMapTheme();
  saveState();
});

$("#addTrifoldTextButton").addEventListener("click", addTrifoldText);
$("#addTrifoldShapeButton").addEventListener("click", addTrifoldShape);
$("#addTrifoldImageButton").addEventListener("click", () => trifoldImageInput.click());
$("#deleteTrifoldElementButton").addEventListener("click", deleteActiveTrifoldElement);
trifoldImageInput.addEventListener("change", () => {
  const [file] = trifoldImageInput.files || [];
  addTrifoldImage(file);
  trifoldImageInput.value = "";
});

document.querySelectorAll("[data-metadata-field]").forEach((input) => {
  input.addEventListener("input", () => {
    state.metadata[input.dataset.metadataField] = input.value;
    saveState();
    renderMetadataCard();
  });
});

nodeForm.addEventListener("submit", addNode);
mapBoard.addEventListener("pointerdown", startSelectionBox);
$("#undoButton")?.addEventListener("click", undo);
$("#redoButton")?.addEventListener("click", redo);
$("#zoomInButton")?.addEventListener("click", zoomIn);
$("#zoomOutButton")?.addEventListener("click", zoomOut);
$("#zoomResetButton")?.addEventListener("click", resetZoom);
$("#exportPngButton")?.addEventListener("click", exportPng);
$("#exportTrifoldPngButton")?.addEventListener("click", exportTrifoldPng);
$("#templateScienceButton")?.addEventListener("click", loadScientificTrifold);
$("#templateEssayButton")?.addEventListener("click", loadEssayTrifold);
$("#templateProjectButton")?.addEventListener("click", loadProjectTrifold);
$("#quickFlipButton")?.addEventListener("click", toggleTrifoldFace);
$("#toggleFoldGuidesButton")?.addEventListener("click", toggleFoldGuides);
$("#elemFontDown")?.addEventListener("click", () => changeActiveElementFontSize(-2));
$("#elemFontUp")?.addEventListener("click", () => changeActiveElementFontSize(2));
$("#elemAlignLeft")?.addEventListener("click", () => setActiveElementAlign("left"));
$("#elemAlignCenter")?.addEventListener("click", () => setActiveElementAlign("center"));
$("#elemAlignRight")?.addEventListener("click", () => setActiveElementAlign("right"));
$("#elemDuplicate")?.addEventListener("click", duplicateActiveTrifoldElement);
$("#elemBringForward")?.addEventListener("click", bringActiveElementForward);
$("#elemDelete")?.addEventListener("click", deleteActiveTrifoldElement);
document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => setActiveElementColor(dot.dataset.color));
});

$("#tasksButton")?.addEventListener("click", toggleTasksMode);
$("#taskForm")?.addEventListener("submit", addTask);
$("#taskSubjectFilter")?.addEventListener("change", (e) => {
  taskFilterSubject = e.target.value;
  renderTasks();
});
$("#taskCategoryFilter")?.addEventListener("change", (e) => {
  taskFilterCategory = e.target.value;
  renderTasks();
});

$("#connectButton").addEventListener("click", connectNodes);
$("#arrangeButton").addEventListener("click", arrangeNodes);
$("#selectAllButton").addEventListener("click", selectAllNodes);
$("#duplicateButton").addEventListener("click", duplicateSelected);
$("#lockButton").addEventListener("click", toggleLockSelected);
$("#snapButton").addEventListener("click", toggleSnapToGrid);
$("#deleteSelectionButton").addEventListener("click", () => deleteSelectedNodes(true));
$("#fullscreenButton").addEventListener("click", toggleFocusMode);
$("#trifoldButton").addEventListener("click", toggleTrifoldMode);
$("#trifoldExteriorButton").addEventListener("click", () => setTrifoldFace("exterior"));
$("#trifoldInteriorButton").addEventListener("click", () => setTrifoldFace("interior"));
$("#exportTrifoldButton").addEventListener("click", exportTrifoldPdf);
$("#ethicsButton").addEventListener("click", loadEthicsMap);
$("#classButton").addEventListener("click", loadClassMap);
$("#personalButton").addEventListener("click", loadPersonalMap);
$("#clearButton").addEventListener("click", clearMap);
$("#exportButton").addEventListener("click", exportPdf);
window.addEventListener("resize", renderConnections);

$("#aiButton")?.addEventListener("click", () => openAiModal("map"));
$("#closeAiModalBtn")?.addEventListener("click", closeAiModal);
document.querySelectorAll(".ai-tab-button").forEach((btn) => {
  btn.addEventListener("click", () => switchAiTab(btn.dataset.aiTab));
});

$("#aiSaveSettingsBtn")?.addEventListener("click", () => {
  const key = $("#aiApiKeyInput")?.value || "";
  const pin = $("#aiPinInput")?.value || "";
  let model = $("#aiModelSelect")?.value || "gpt-4o-mini";
  if (model === "custom") {
    model = $("#aiCustomModelInput")?.value.trim() || "gpt-4o-mini";
  }
  saveAiSettings(key, pin, model);
  window.alert("✅ Configuración de IA guardada correctamente.");
  closeAiModal();
});

$("#aiGenerateMapBtn")?.addEventListener("click", async () => {
  const promptText = $("#aiMapPrompt")?.value.trim();
  if (!promptText) {
    window.alert("Por favor escribe un tema o texto para generar el mapa.");
    return;
  }
  const btn = $("#aiGenerateMapBtn");
  const originalText = btn.textContent;
  try {
    btn.textContent = "⏳ Generando mapa con IA...";
    btn.disabled = true;
    await generateMapWithAi(promptText);
    closeAiModal();
  } catch (err) {
    console.error(err);
    window.alert(err.message || "Error al generar mapa con IA.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

$("#aiGenerateTrifoldBtn")?.addEventListener("click", async () => {
  const promptText = $("#aiTrifoldPrompt")?.value.trim();
  if (!promptText) {
    window.alert("Por favor escribe el tema de tu tríptico.");
    return;
  }
  const btn = $("#aiGenerateTrifoldBtn");
  const originalText = btn.textContent;
  try {
    btn.textContent = "⏳ Redactando tríptico con IA...";
    btn.disabled = true;
    await generateTrifoldWithAi(promptText);
    closeAiModal();
  } catch (err) {
    console.error(err);
    window.alert(err.message || "Error al generar tríptico con IA.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

$("#aiGenerateTasksBtn")?.addEventListener("click", async () => {
  const promptText = $("#aiTasksPrompt")?.value.trim();
  if (!promptText) {
    window.alert("Por favor pega las indicaciones o apuntes para extraer tareas.");
    return;
  }
  const btn = $("#aiGenerateTasksBtn");
  const originalText = btn.textContent;
  try {
    btn.textContent = "⏳ Extrayendo tareas con IA...";
    btn.disabled = true;
    await generateTasksWithAi(promptText);
    closeAiModal();
  } catch (err) {
    console.error(err);
    window.alert(err.message || "Error al extraer tareas con IA.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

if (state.nodes.length && state.layoutVersion !== 4) {
  arrangeNodes();
} else {
  render();
}
renderTasks();
