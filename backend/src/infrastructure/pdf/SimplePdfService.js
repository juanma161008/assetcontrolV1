function escapePdfText(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
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
    "",
    `Creado por: ${orden?.creador_nombre || orden?.creado_por || "-"}`,
    `Correo: ${orden?.creador_email || "-"}`,
    "",
    "Documento generado automaticamente por AssetControl."
  ];

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

function buildPdfBuffer(lines = []) {
  const content = buildContentStream(lines);
  const contentLength = Buffer.byteLength(content, "utf8");

  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export default class SimplePdfService {
  async generar(ordenData = {}) {
    return buildPdfBuffer(toLines(ordenData));
  }
}
