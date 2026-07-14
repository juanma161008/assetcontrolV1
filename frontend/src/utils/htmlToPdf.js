import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Renderiza un documento HTML completo (como el que genera buildMaintenanceOrderHtml)
// en un iframe oculto y lo convierte en un PDF real con el mismo diseño, para poder
// incluirlo en descargas masivas (ZIP) sin depender del dialogo de impresion manual.
export async function renderHtmlToPdfBlob(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "1131px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error("No se pudo preparar el documento para exportar");
    }

    doc.open();
    doc.write(html);
    doc.close();

    await new Promise((resolve) => {
      if (doc.readyState === "complete") {
        resolve();
        return;
      }
      iframe.addEventListener("load", () => resolve(), { once: true });
      globalThis.setTimeout(resolve, 1500);
    });

    const images = Array.from(doc.images || []);
    await Promise.all(
      images.map((img) => new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }))
    );

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgWidth = A4_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= A4_HEIGHT_MM;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= A4_HEIGHT_MM;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}
