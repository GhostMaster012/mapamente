async function waitForVisualAssets(root) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const images = [...root.querySelectorAll("img")];
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
}

async function exportTrifoldPdf() {
  const exportButton = $("#exportTrifoldButton");
  const oldButtonText = exportButton.innerHTML;
  const safeFileName = (state.trifold.title || "triptico").replace(/[\\/:*?"<>|]+/g, "-").trim() || "triptico";
  const originalFace = state.trifold.face;
  exportButton.disabled = true;
  exportButton.innerHTML = "Generando PDF...";
  trifoldBoard.classList.add("exporting");

  try {
    if (!window.html2canvas || !window.jspdf) throw new Error("Librerías de PDF no disponibles");
    const captures = [];
    for (const face of ["exterior", "interior"]) {
      state.trifold.face = face;
      renderTrifold();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await waitForVisualAssets(trifoldBoard);
      captures.push(await window.html2canvas(trifoldBoard, {
        scale: 1.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
      }));
    }

    const { jsPDF } = window.jspdf;
    const margin = 8;
    const pageWidth = 420;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = imageWidth * captures[0].height / captures[0].width;
    const pageHeight = Math.max(190, imageHeight + margin * 2);
    const buildPdf = (quality) => {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageWidth, pageHeight], compress: true });
      captures.forEach((canvas, index) => {
        if (index > 0) pdf.addPage([pageWidth, pageHeight], "landscape");
        const imageData = canvas.toDataURL("image/jpeg", quality);
        pdf.addImage(imageData, "JPEG", margin, margin, imageWidth, imageHeight, undefined, "MEDIUM");
      });
      return pdf;
    };

    let pdf = buildPdf(0.9);
    let blob = pdf.output("blob");
    if (blob.size > 9 * 1024 * 1024) {
      pdf = buildPdf(0.82);
      blob = pdf.output("blob");
    }
    if (blob.size > 9 * 1024 * 1024) {
      pdf = buildPdf(0.74);
      blob = pdf.output("blob");
    }

    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `${safeFileName}.pdf`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    if (blob.size > 9 * 1024 * 1024) {
      window.alert(`El PDF se generó con ${(blob.size / (1024 * 1024)).toFixed(1)} MB. Reduce el texto o las imágenes si Moodle lo rechaza.`);
    }
  } catch (error) {
    console.error(error);
    window.alert("No se pudo generar el PDF directo. Se abrirá la impresión del navegador.");
    document.title = state.trifold.title || "Tríptico";
    window.print();
  } finally {
    state.trifold.face = originalFace;
    trifoldBoard.classList.remove("exporting");
    renderTrifold();
    saveState();
    exportButton.disabled = false;
    exportButton.innerHTML = oldButtonText;
  }
}

async function exportTrifoldPng() {
  const exportButton = $("#exportTrifoldPngButton");
  const oldButtonText = exportButton ? exportButton.innerHTML : "";
  const safeFileName = (state.trifold.title || "triptico").replace(/[\\/:*?"<>|]+/g, "-").trim() || "triptico";
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.innerHTML = "Generando PNG...";
  }
  trifoldBoard.classList.add("exporting");

  try {
    if (!window.html2canvas) throw new Error("html2canvas no disponible");
    await waitForVisualAssets(trifoldBoard);
    const canvas = await window.html2canvas(trifoldBoard, {
      scale: 2.0,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = `${safeFileName}-${state.trifold.face}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  } catch (error) {
    console.error(error);
    window.alert("No se pudo generar la imagen PNG.");
  } finally {
    trifoldBoard.classList.remove("exporting");
    if (exportButton) {
      exportButton.disabled = false;
      exportButton.innerHTML = oldButtonText;
    }
  }
}

async function exportPng() {
  if (!state.nodes.length) {
    window.alert("Agrega al menos un concepto antes de exportar.");
    return;
  }

  const exportButton = $("#exportPngButton");
  const oldButtonText = exportButton ? exportButton.innerHTML : "";
  const safeFileName = (state.title || "mapa-conceptual").replace(/[\\/:*?"<>|]+/g, "-").trim() || "mapa-conceptual";
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.innerHTML = "Generando PNG...";
  }
  mapBoard.classList.add("exporting");
  const previousZoom = currentZoom;
  setZoom(1.0);

  try {
    if (!window.html2canvas) throw new Error("html2canvas no disponible");
    renderNodes();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderConnections();
    await waitForVisualAssets(mapBoard);
    const imageCanvas = await window.html2canvas(mapBoard, {
      scale: 2.0,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = imageCanvas.toDataURL("image/png");
    downloadLink.download = `${safeFileName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  } catch (error) {
    console.error(error);
    window.alert("No se pudo generar la imagen PNG.");
  } finally {
    mapBoard.classList.remove("exporting");
    setZoom(previousZoom);
    if (exportButton) {
      exportButton.disabled = false;
      exportButton.innerHTML = oldButtonText;
    }
  }
}

async function exportPdf() {
  if (!state.nodes.length) {
    window.alert("Agrega al menos un concepto antes de exportar.");
    return;
  }

  const exportButton = $("#exportButton");
  const oldButtonText = exportButton.innerHTML;
  const safeFileName = (state.title || "mapa-conceptual").replace(/[\\/:*?"<>|]+/g, "-").trim() || "mapa-conceptual";
  exportButton.disabled = true;
  exportButton.innerHTML = "Generando PDF...";
  mapBoard.classList.add("exporting");
  const previousZoom = currentZoom;
  setZoom(1.0);

  try {
    if (!window.html2canvas || !window.jspdf) throw new Error("Librerías de PDF no disponibles");
    renderNodes();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderConnections();
    renderNodes();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderConnections();
    await waitForVisualAssets(mapBoard);
    const imageCanvas = await window.html2canvas(mapBoard, {
      scale: 1.75,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });
    const { jsPDF } = window.jspdf;
    const margin = 8;
    const pageWidth = Math.max(420, Math.min(600, imageCanvas.width / 8));
    const imageRatio = (pageWidth - margin * 2) / imageCanvas.width;
    const imageWidth = imageCanvas.width * imageRatio;
    const imageHeight = imageCanvas.height * imageRatio;
    const pageHeight = Math.max(297, imageHeight + margin * 2);
    const imageX = (pageWidth - imageWidth) / 2;
    const imageY = (pageHeight - imageHeight) / 2;
    const buildPdf = (quality) => {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageWidth, pageHeight], compress: true });
      const imageData = imageCanvas.toDataURL("image/jpeg", quality);
      pdf.addImage(imageData, "JPEG", imageX, imageY, imageWidth, imageHeight, undefined, "MEDIUM");
      return pdf;
    };

    let pdf = buildPdf(0.92);
    let blob = pdf.output("blob");
    if (blob.size > 9 * 1024 * 1024) {
      pdf = buildPdf(0.82);
      blob = pdf.output("blob");
    }
    if (blob.size > 9 * 1024 * 1024) {
      pdf = buildPdf(0.72);
      blob = pdf.output("blob");
    }

    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `${safeFileName}.pdf`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    if (blob.size > 9 * 1024 * 1024) {
      window.alert(`El PDF se generó con ${(blob.size / (1024 * 1024)).toFixed(1)} MB. Moodle podría rechazarlo; intenta reducir el contenido del mapa si ocurre.`);
    }
  } catch (error) {
    console.error(error);
    window.alert("No se pudo generar el PDF directo. Se abrirá la impresión del navegador.");
    document.title = state.title || "Mapa conceptual";
    window.print();
  } finally {
    mapBoard.classList.remove("exporting");
    setZoom(previousZoom);
    exportButton.disabled = false;
    exportButton.innerHTML = oldButtonText;
  }
}

window.addEventListener("afterprint", () => {
  requestAnimationFrame(() => {
    if (mapViewport) {
      mapViewport.style.overflowX = "scroll";
      mapViewport.style.overflowY = "auto";
      mapViewport.scrollLeft = focusScroll.left;
      mapViewport.scrollTop = focusScroll.top;
    }
    renderNodes();
    renderConnections();
  });
});
