function escapePdfText(value = "") {
  return String(value).replace(/[\\()]/g, String.raw`\$&`);
}
function toLines(orden = {}) {
  const lines = [
    "MICROCINCO & CIA LTDA - ORDEN DE TRABAJO",
    "",
    `Orden: ${orden?.numero || orden?.id || "-"}`,
    `ID: ${orden?.id || "-"}`,
    `Estado: ${orden?.estado || "-"}`,
    `Firmada: ${orden?.firmada ? "SI" : "NO"}`,
    `Fecha: ${orden?.fecha || "-"}`,
    `Total mantenimientos: ${orden?.total_mantenimientos ?? "-"}`,
    "",
    `Activos: ${orden?.activos || "-"}`,
    `Entidades: ${orden?.entidades || "-"}`,
    `Reportes: ${orden?.reportes || "-"}`
  ];

  if (orden?.firmante_nombre) {
    lines.push(
      "",
      "Firma del usuario habitual",
      `Nombre: ${orden.firmante_nombre}`,
      `Area: ${orden?.firmante_area || "-"}`,
      `Cargo: ${orden?.firmante_cargo || "-"}`
    );
  }

  if (orden?.interventor_nombre) {
    lines.push(
      "",
      "Autorizacion del interventor",
      `Interventor: ${orden.interventor_nombre}`
    );
    if (orden?.comentario_interventor) {
      lines.push(`Comentario: ${orden.comentario_interventor}`);
    }
  }

  lines.push(
    "",
    `Creado por: ${orden?.creador_nombre || orden?.creado_por || "-"}`,
    `Correo: ${orden?.creador_email || "-"}`,
    "",
    "Documento generado automaticamente por AssetControl."
  );

  return lines;
}

function buildContentStream(lines = []) {
  const limited = Array.isArray(lines) ? lines.slice(0, 44) : [];
  if (!limited.length) {
    limited.push("Sin informacion para mostrar.");
  }

  const commands = ["BT", "/F1 11 Tf", "50 780 Td"];
  limited.forEach((line, index) => {
    if (index > 0) {
      commands.push("0 -16 Td");
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");

  return commands.join("\n");
}

// Las fuentes simples de PDF codifican cada glifo en un solo byte. Usamos
// WinAnsiEncoding (compatible con Latin-1 para tildes/eñe) y escribimos el
// stream de contenido como bytes latin1 en vez de UTF-8, que es lo que
// causaba caracteres acentuados corruptos (p. ej. "Suárez" -> "Su¯¡rez").
function buildPdfBuffer(lines = []) {
  const content = buildContentStream(lines);
  const contentBuffer = Buffer.from(content, "latin1");

  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  ];

  const chunks = [];
  const offsets = [0, 0, 0, 0, 0, 0];
  let currentOffset = 0;

  const pushText = (str) => {
    const buf = Buffer.from(str, "latin1");
    chunks.push(buf);
    currentOffset += buf.length;
  };

  pushText("%PDF-1.4\n");

  for (let i = 1; i <= 4; i += 1) {
    offsets[i] = currentOffset;
    pushText(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }

  offsets[5] = currentOffset;
  pushText(`5 0 obj\n<< /Length ${contentBuffer.length} >>\nstream\n`);
  chunks.push(contentBuffer);
  currentOffset += contentBuffer.length;
  pushText("\nendstream\nendobj\n");

  const xrefOffset = currentOffset;
  let xref = "xref\n0 6\n";
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  pushText(xref);

  return Buffer.concat(chunks);
}

export default class SimplePdfService {
  async generar(ordenData = {}) {
    return buildPdfBuffer(toLines(ordenData));
  }
}
