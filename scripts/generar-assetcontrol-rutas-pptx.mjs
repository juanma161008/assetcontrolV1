import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "AssetControl";
pptx.company = "AssetControl";
pptx.subject = "UI route deck";
pptx.title = "AssetControl - UI by routes";
pptx.lang = "es-CO";

const C = {
  navy: "021F59",
  blue: "021E73",
  red: "F21326",
  bg: "F5F7FA",
  white: "FFFFFF",
  border: "E2E8F0",
  ink: "0F172A",
  muted: "64748B",
  success: "10B981",
  warning: "F59E0B",
  danger: "EF4444",
  info: "3B82F6",
  softBlue: "DBEAFE",
  softGreen: "DCFCE7",
  softAmber: "FEF3C7",
  softRed: "FEE2E2"
};

const FONT = "Arial";

function addFullBg(slide, color = C.bg) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color },
    line: { color }
  });
}

function addHeader(slide, title, subtitle = "") {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.85,
    fill: { color: C.navy },
    line: { color: C.navy }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.74,
    w: 13.333,
    h: 0.11,
    fill: { color: C.blue },
    line: { color: C.blue }
  });

  slide.addText("AssetControl", {
    x: 0.45,
    y: 0.22,
    w: 2.2,
    h: 0.25,
    fontFace: FONT,
    fontSize: 15,
    bold: true,
    color: C.white
  });

  slide.addText(title, {
    x: 2.9,
    y: 0.22,
    w: 5.8,
    h: 0.25,
    fontFace: FONT,
    fontSize: 13,
    bold: true,
    color: C.white
  });

  const menu = ["Inicio", "Inventario", "Mantenimientos", "Administracion"];
  menu.forEach((item, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.45 + i * 1.28,
      y: 0.5,
      w: 1.16,
      h: 0.22,
      rectRadius: 0.11,
      fill: { color: i === 0 ? "FFFFFF" : "1E3A8A" },
      line: { color: i === 0 ? "FFFFFF" : "1E3A8A" }
    });

    slide.addText(item, {
      x: 0.49 + i * 1.28,
      y: 0.545,
      w: 1.08,
      h: 0.12,
      fontFace: FONT,
      fontSize: 7,
      bold: true,
      color: i === 0 ? C.navy : C.white,
      align: "center"
    });
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 10.4,
    y: 0.23,
    w: 2.45,
    h: 0.38,
    rectRadius: 0.19,
    fill: { color: "FFFFFF" },
    line: { color: "FFFFFF" }
  });

  slide.addText("Maria Perez  |  Admin", {
    x: 10.55,
    y: 0.35,
    w: 2.2,
    h: 0.12,
    fontFace: FONT,
    fontSize: 8,
    bold: true,
    color: C.navy,
    align: "center"
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.45,
      y: 0.95,
      w: 12.2,
      h: 0.2,
      fontFace: FONT,
      fontSize: 10,
      color: C.muted
    });
  }
}

function addSurface(slide, x, y, w, h, radius = 0.08, fill = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: radius,
    fill: { color: fill },
    line: { color: C.border }
  });
}

function addInput(slide, x, y, w, label, placeholder = "") {
  slide.addText(label, {
    x,
    y,
    w,
    h: 0.16,
    fontFace: FONT,
    fontSize: 9,
    color: C.muted
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y: y + 0.18,
    w,
    h: 0.34,
    rectRadius: 0.04,
    fill: { color: "F8FAFC" },
    line: { color: C.border }
  });

  if (placeholder) {
    slide.addText(placeholder, {
      x: x + 0.08,
      y: y + 0.295,
      w: w - 0.16,
      h: 0.12,
      fontFace: FONT,
      fontSize: 8,
      color: "94A3B8"
    });
  }
}

function addButton(slide, x, y, w, h, text, color = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color },
    line: { color }
  });

  slide.addText(text, {
    x,
    y: y + 0.09,
    w,
    h: 0.14,
    fontFace: FONT,
    fontSize: 9,
    bold: true,
    color: C.white,
    align: "center"
  });
}

function addPill(slide, x, y, text, fill, color, w = 1.05) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.22,
    rectRadius: 0.11,
    fill: { color: fill },
    line: { color: fill }
  });

  slide.addText(text, {
    x,
    y: y + 0.055,
    w,
    h: 0.1,
    fontFace: FONT,
    fontSize: 7,
    bold: true,
    color,
    align: "center"
  });
}

function addTable(slide, cfg) {
  const {
    x,
    y,
    w,
    h,
    columns,
    rowCount,
    headColor = "F8FAFC",
    headText = C.ink,
    bodyText = C.ink
  } = cfg;

  addSurface(slide, x, y, w, h);

  const headH = 0.34;
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.01,
    y: y + 0.01,
    w: w - 0.02,
    h: headH,
    fill: { color: headColor },
    line: { color: headColor }
  });

  const colW = (w - 0.1) / columns.length;
  columns.forEach((col, i) => {
    slide.addText(col, {
      x: x + 0.05 + i * colW,
      y: y + 0.12,
      w: colW - 0.02,
      h: 0.12,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: headText,
      align: "center"
    });

    if (i > 0) {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.05 + i * colW,
        y: y + 0.01,
        w: 0,
        h: h - 0.05,
        line: { color: "EEF2F7", pt: 1 }
      });
    }
  });

  const bodyTop = y + headH + 0.02;
  const rowH = (h - headH - 0.08) / rowCount;

  for (let i = 0; i < rowCount; i += 1) {
    const rowY = bodyTop + i * rowH;
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.02,
      y: rowY,
      w: w - 0.04,
      h: 0,
      line: { color: "EEF2F7", pt: 1 }
    });

    columns.forEach((_, j) => {
      slide.addText("-", {
        x: x + 0.05 + j * colW,
        y: rowY + 0.08,
        w: colW - 0.02,
        h: 0.12,
        fontFace: FONT,
        fontSize: 8,
        color: bodyText,
        align: "center"
      });
    });
  }
}

function addKpi(slide, x, y, title, value, accent) {
  addSurface(slide, x, y, 2.98, 1.18);

  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.06,
    h: 1.18,
    fill: { color: accent },
    line: { color: accent }
  });

  slide.addText(title, {
    x: x + 0.16,
    y: y + 0.16,
    w: 2.7,
    h: 0.16,
    fontFace: FONT,
    fontSize: 9,
    color: C.muted
  });

  slide.addText(String(value), {
    x: x + 0.16,
    y: y + 0.45,
    w: 2.7,
    h: 0.3,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: C.ink
  });
}

function addFooterTag(slide, text) {
  slide.addText(text, {
    x: 0.45,
    y: 7.18,
    w: 12.4,
    h: 0.16,
    fontFace: FONT,
    fontSize: 7,
    color: "94A3B8"
  });
}

function slideCover() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.navy);

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 5.6,
    w: 13.333,
    h: 1.9,
    fill: { color: C.blue },
    line: { color: C.blue }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 9.7,
    y: 0,
    w: 3.633,
    h: 5.6,
    fill: { color: C.red },
    line: { color: C.red },
    transparency: 82
  });

  slide.addText("AssetControl", {
    x: 0.8,
    y: 1.2,
    w: 8,
    h: 0.85,
    fontFace: FONT,
    fontSize: 52,
    bold: true,
    color: C.white
  });

  slide.addText("UI master deck by routes", {
    x: 0.86,
    y: 2.2,
    w: 6.2,
    h: 0.34,
    fontFace: FONT,
    fontSize: 18,
    color: "DCE7FF"
  });

  [
    "Login",
    "Selector entidad",
    "Inicio",
    "Activos",
    "Mantenimientos",
    "Cronograma",
    "Ordenes",
    "Auditoria",
    "Entidades",
    "Usuarios",
    "Mi cuenta",
    "Ayuda",
    "Acerca de"
  ].forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    addPill(slide, 0.9 + col * 1.8, 3.2 + row * 0.42, item, "1E3A8A", C.white, 1.55);
  });

  addFooterTag(slide, "AssetControl design map | 13 route slides + cover");
}

function slideLogin() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Login / Registro", "Pantalla de autenticacion con logos y CTA principal");

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.45,
    y: 1.25,
    w: 5.1,
    h: 5.6,
    fill: { color: C.navy },
    line: { color: C.navy }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.45,
    y: 5.35,
    w: 5.1,
    h: 1.5,
    fill: { color: C.blue },
    line: { color: C.blue }
  });

  slide.addText("AssetControl", {
    x: 0.95,
    y: 2.0,
    w: 4.0,
    h: 0.5,
    fontFace: FONT,
    fontSize: 30,
    bold: true,
    color: C.white
  });

  slide.addText("Gestion de activos y mantenimientos", {
    x: 0.95,
    y: 2.62,
    w: 4.2,
    h: 0.34,
    fontFace: FONT,
    fontSize: 12,
    color: "DDE8FF"
  });

  addSurface(slide, 5.85, 1.45, 6.95, 5.2, 0.1, C.white);

  slide.addText("Iniciar sesion", {
    x: 6.25,
    y: 1.88,
    w: 2.3,
    h: 0.28,
    fontFace: FONT,
    fontSize: 19,
    bold: true,
    color: C.ink
  });

  slide.addText("Accede a tu cuenta para gestionar tus activos", {
    x: 6.25,
    y: 2.2,
    w: 4.9,
    h: 0.2,
    fontFace: FONT,
    fontSize: 10,
    color: C.muted
  });

  addInput(slide, 6.25, 2.65, 6.15, "Email", "correo@empresa.com");
  addInput(slide, 6.25, 3.35, 6.15, "Contrasena", "********");

  addButton(slide, 6.25, 4.15, 6.15, 0.44, "Ingresar", C.blue);
  addButton(slide, 6.25, 4.7, 6.15, 0.44, "Registrate aqui", "334155");

  addFooterTag(slide, "Ruta: /auth/login | Forms: login + registro");
}

function slideEntitySelector() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.navy);

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: C.blue },
    line: { color: C.blue },
    transparency: 72
  });

  addSurface(slide, 2.0, 1.0, 9.35, 5.55, 0.13, "F8FAFC");

  slide.addText("Selecciona tu entidad de trabajo", {
    x: 2.35,
    y: 1.35,
    w: 4.8,
    h: 0.34,
    fontFace: FONT,
    fontSize: 18,
    bold: true,
    color: C.navy
  });

  slide.addText("Elige la entidad para cargar dashboard, activos y mantenimientos", {
    x: 2.35,
    y: 1.73,
    w: 6.4,
    h: 0.2,
    fontFace: FONT,
    fontSize: 10,
    color: C.muted
  });

  addInput(slide, 2.35, 2.1, 8.6, "Buscar entidad", "Nombre de entidad");

  const cards = [
    "Clinica Norte",
    "Clinica Centro",
    "Hospital Sur",
    "Sede Niquia",
    "Sede Autopista",
    "Laboratorio Central"
  ];

  cards.forEach((name, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 2.35 + col * 4.35;
    const y = 2.92 + row * 0.9;

    addSurface(slide, x, y, 4.0, 0.72, 0.07, "EFF6FF");
    slide.addText(name, {
      x: x + 0.18,
      y: y + 0.19,
      w: 2.8,
      h: 0.14,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: C.ink
    });
    slide.addText("Ingresar a esta entidad", {
      x: x + 0.18,
      y: y + 0.38,
      w: 2.3,
      h: 0.12,
      fontFace: FONT,
      fontSize: 8,
      color: C.blue
    });
  });

  addButton(slide, 8.8, 5.95, 2.15, 0.42, "Cerrar sesion", C.red);
  addFooterTag(slide, "Vista: entity-selector-shell | card + search + option grid");
}

function slideHome() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Inicio / Dashboard", "KPIs de activos, resumen y pendientes semanales");

  addPill(slide, 0.55, 1.28, "Entidad: Sede Niquia", "EFF6FF", "1E3A8A", 2.2);

  addKpi(slide, 0.55, 1.75, "Total activos", 128, C.info);
  addKpi(slide, 3.7, 1.75, "Disponibles", 96, C.success);
  addKpi(slide, 6.85, 1.75, "En mantenimiento", 18, C.warning);
  addKpi(slide, 10.0, 1.75, "Fuera de servicio", 14, C.danger);

  addSurface(slide, 0.55, 3.2, 6.3, 3.85);
  slide.addText("Resumen estadistico", {
    x: 0.85,
    y: 3.42,
    w: 2.8,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  addSurface(slide, 0.95, 3.82, 1.8, 1.3, 0.06, "F8FAFC");
  addSurface(slide, 2.95, 3.82, 1.8, 1.3, 0.06, "F8FAFC");
  addSurface(slide, 4.95, 3.82, 1.5, 1.3, 0.06, "F8FAFC");

  slide.addText("Disponibles", { x: 1.15, y: 4.0, w: 1.35, h: 0.12, fontFace: FONT, fontSize: 8, color: C.muted });
  slide.addText("75%", { x: 1.15, y: 4.25, w: 1.35, h: 0.25, fontFace: FONT, fontSize: 19, bold: true, color: C.ink, align: "center" });

  slide.addText("Con problemas", { x: 3.1, y: 4.0, w: 1.5, h: 0.12, fontFace: FONT, fontSize: 8, color: C.muted });
  slide.addText("32", { x: 3.1, y: 4.25, w: 1.5, h: 0.25, fontFace: FONT, fontSize: 19, bold: true, color: C.ink, align: "center" });

  slide.addText("Estado", { x: 5.1, y: 4.0, w: 1.1, h: 0.12, fontFace: FONT, fontSize: 8, color: C.muted, align: "center" });
  addPill(slide, 5.2, 4.3, "Bueno", C.softAmber, "92400E", 0.95);

  addSurface(slide, 7.15, 3.2, 5.65, 3.85);
  slide.addText("Pendientes de la semana", {
    x: 7.45,
    y: 3.42,
    w: 3.2,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  const weeklyRows = [
    ["Preventivo", "Equipo RX-12", "Lun 09/03", "Pendiente"],
    ["Correctivo", "Servidor Lab", "Mar 10/03", "En proceso"],
    ["Predictivo", "Monitor UCI", "Mie 11/03", "Pendiente"],
    ["Calibracion", "Bomba INF", "Jue 12/03", "Pendiente"]
  ];

  weeklyRows.forEach((r, i) => {
    const y = 3.82 + i * 0.76;
    addSurface(slide, 7.45, y, 5.05, 0.62, 0.05, "F8FAFC");
    slide.addText(r[0], { x: 7.62, y: y + 0.13, w: 1.2, h: 0.12, fontFace: FONT, fontSize: 8, bold: true, color: C.ink });
    slide.addText(r[1], { x: 8.86, y: y + 0.13, w: 1.8, h: 0.12, fontFace: FONT, fontSize: 8, color: C.ink });
    slide.addText(r[2], { x: 10.65, y: y + 0.13, w: 0.95, h: 0.12, fontFace: FONT, fontSize: 8, color: C.muted, align: "center" });

    const stateMap = {
      Pendiente: ["FFF7ED", "9A3412"],
      "En proceso": ["EFF6FF", "1D4ED8"]
    };

    const [fill, text] = stateMap[r[3]] || ["ECFDF5", "166534"];
    addPill(slide, 11.66, y + 0.2, r[3], fill, text, 0.8);
  });

  addFooterTag(slide, "Ruta: / | Home dashboard with KPI + summary + weekly panel");
}

function slideActivos() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Activos", "Inventario, filtros, tabla y modal de detalle");

  addSurface(slide, 0.55, 1.25, 12.25, 0.85);
  addInput(slide, 0.85, 1.43, 7.6, "Buscar activo", "Numero reporte, serial, equipo");
  addButton(slide, 8.75, 1.6, 1.9, 0.36, "Nuevo activo", C.blue);
  addPill(slide, 10.9, 1.64, "128 registros", "EEF5FF", "0B2A6F", 1.45);

  addTable(slide, {
    x: 0.55,
    y: 2.25,
    w: 8.35,
    h: 4.7,
    columns: ["ID", "Equipo", "Serial", "Estado", "Sede", "Reporte", "Acciones"],
    rowCount: 8
  });

  addSurface(slide, 9.2, 2.25, 3.6, 4.7);
  slide.addText("Modal detalle activo", {
    x: 9.45,
    y: 2.5,
    w: 2.8,
    h: 0.18,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  addSurface(slide, 9.45, 2.82, 3.1, 0.58, 0.05, "F8FAFC");
  slide.addText("Equipo: Monitor UCI", { x: 9.6, y: 3.03, w: 2.6, h: 0.12, fontFace: FONT, fontSize: 8, color: C.ink });

  addSurface(slide, 9.45, 3.52, 3.1, 0.58, 0.05, "F8FAFC");
  slide.addText("Serial: M5-AC-9844", { x: 9.6, y: 3.73, w: 2.6, h: 0.12, fontFace: FONT, fontSize: 8, color: C.ink });

  addSurface(slide, 9.45, 4.22, 3.1, 1.12, 0.05, "F8FAFC");
  slide.addText("Historial mantenimiento", { x: 9.6, y: 4.45, w: 2.5, h: 0.12, fontFace: FONT, fontSize: 8, color: C.muted });

  addButton(slide, 9.45, 5.58, 1.45, 0.34, "PDF", C.red);
  addButton(slide, 11.1, 5.58, 1.45, 0.34, "Enviar", "0284C7");

  addFooterTag(slide, "Ruta: /activos | search + data table + detail modal actions");
}

function slideMantenimientos() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Mantenimientos", "Formulario operativo, tabla y estado de trabajo");

  addSurface(slide, 0.55, 1.25, 12.25, 1.48, 0.08, "F8FAFC");

  const fields = [
    ["Fecha", 0.85, 1.45, 1.55, "dd/mm/aaaa"],
    ["Activo", 2.55, 1.45, 2.15, "Buscar activo"],
    ["Tipo", 4.85, 1.45, 1.5, "Preventivo"],
    ["Plan", 6.5, 1.45, 1.45, "Semanal"],
    ["Tecnico", 8.1, 1.45, 1.75, "Nombre"],
    ["Descripcion", 10.0, 1.45, 2.25, "Trabajo a realizar"]
  ];

  fields.forEach(([label, x, y, w, ph]) => addInput(slide, x, y, w, label, ph));

  addButton(slide, 10.05, 2.27, 2.2, 0.34, "Guardar mantenimiento", C.blue);

  addTable(slide, {
    x: 0.55,
    y: 2.95,
    w: 12.25,
    h: 3.95,
    columns: ["ID", "Fecha", "Activo", "Tipo", "Estado", "Tecnico", "Acciones"],
    rowCount: 8,
    headColor: C.navy,
    headText: C.white
  });

  addPill(slide, 7.8, 3.76, "Pendiente", "FFF7ED", "9A3412", 0.95);
  addPill(slide, 7.8, 4.24, "En proceso", "EFF6FF", "1D4ED8", 1.02);
  addPill(slide, 7.8, 4.72, "Finalizado", "ECFDF5", "166534", 0.95);

  addFooterTag(slide, "Ruta: /mantenimientos | form grid + status table + modal flow");
}

function slideCronograma() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Cronograma", "Vista calendario para planificacion y carga semanal");

  addSurface(slide, 0.55, 1.25, 8.95, 5.75);
  slide.addText("Marzo 2026", {
    x: 0.85,
    y: 1.52,
    w: 1.7,
    h: 0.2,
    fontFace: FONT,
    fontSize: 12,
    bold: true,
    color: C.ink
  });

  const days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  days.forEach((d, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.82 + i * 1.2,
      y: 1.85,
      w: 1.1,
      h: 0.28,
      rectRadius: 0.03,
      fill: { color: "F1F5F9" },
      line: { color: "F1F5F9" }
    });

    slide.addText(d, {
      x: 0.86 + i * 1.2,
      y: 1.95,
      w: 1.02,
      h: 0.1,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: C.muted,
      align: "center"
    });
  });

  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      addSurface(slide, 0.82 + c * 1.2, 2.2 + r * 0.9, 1.1, 0.82, 0.03, C.white);
      slide.addText(String(r * 7 + c + 1), {
        x: 0.88 + c * 1.2,
        y: 2.29 + r * 0.9,
        w: 0.22,
        h: 0.1,
        fontFace: FONT,
        fontSize: 7,
        color: C.muted
      });
    }
  }

  addPill(slide, 2.06, 3.45, "3 tareas", "DBEAFE", "1E3A8A", 0.7);
  addPill(slide, 4.46, 4.35, "2 tareas", "DCFCE7", "166534", 0.7);
  addPill(slide, 5.66, 5.25, "1 tarea", "FEE2E2", "991B1B", 0.65);

  addSurface(slide, 9.8, 1.25, 3.0, 5.75);
  slide.addText("Pendientes del mes", {
    x: 10.05,
    y: 1.52,
    w: 2.3,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  [
    "Calibracion - Bomba INF",
    "Preventivo - Servidor LAB",
    "Correctivo - Equipo RX-2",
    "Predictivo - Monitor QX"
  ].forEach((txt, i) => {
    addSurface(slide, 10.05, 1.9 + i * 0.95, 2.5, 0.78, 0.05, "F8FAFC");
    slide.addText(txt, {
      x: 10.18,
      y: 2.15 + i * 0.95,
      w: 2.25,
      h: 0.2,
      fontFace: FONT,
      fontSize: 8,
      color: C.ink
    });
  });

  addFooterTag(slide, "Ruta: /cronograma | monthly planner + task sidebar");
}

function slideOrdenes() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Ordenes", "Gestion de ordenes de mantenimiento y firma digital");

  addTable(slide, {
    x: 0.55,
    y: 1.25,
    w: 7.0,
    h: 5.75,
    columns: ["Nro", "Activo", "Tecnico", "Fecha", "Estado"],
    rowCount: 9,
    headColor: "F8FAFC",
    headText: C.ink
  });

  addPill(slide, 6.3, 2.0, "Firmada", C.softGreen, "166534", 0.78);
  addPill(slide, 6.3, 2.48, "Pendiente", C.softAmber, "9A3412", 0.88);
  addPill(slide, 6.3, 2.96, "Anulada", C.softRed, "991B1B", 0.78);

  addSurface(slide, 7.85, 1.25, 4.95, 2.55);
  slide.addText("Detalle de orden", {
    x: 8.1,
    y: 1.52,
    w: 2.2,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  addInput(slide, 8.1, 1.86, 2.2, "Orden", "OR-2026-0102");
  addInput(slide, 10.45, 1.86, 2.1, "Estado", "Pendiente");
  addInput(slide, 8.1, 2.5, 4.45, "Activo", "Equipo RX-17");

  addSurface(slide, 7.85, 4.05, 4.95, 2.95);
  slide.addText("Firma digital", {
    x: 8.1,
    y: 4.32,
    w: 1.7,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  addSurface(slide, 8.1, 4.62, 4.45, 1.65, 0.05, "F8FAFC");
  slide.addText("Area de firma", {
    x: 9.65,
    y: 5.37,
    w: 1.3,
    h: 0.12,
    fontFace: FONT,
    fontSize: 8,
    color: C.muted,
    align: "center"
  });

  addButton(slide, 8.1, 6.42, 2.05, 0.34, "Confirmar firma", C.blue);
  addButton(slide, 10.5, 6.42, 2.05, 0.34, "Cancelar", "475569");

  addFooterTag(slide, "Ruta: /ordenes | order table + detail + sign modal");
}

function slideAuditoria() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Auditoria", "Seguimiento de acciones y trazabilidad administrativa");

  addSurface(slide, 0.55, 1.25, 12.25, 0.95);
  addInput(slide, 0.85, 1.43, 2.2, "Usuario", "Todos");
  addInput(slide, 3.25, 1.43, 2.2, "Modulo", "Todos");
  addInput(slide, 5.65, 1.43, 2.2, "Accion", "Todas");
  addInput(slide, 8.05, 1.43, 2.2, "Fecha", "03/2026");
  addButton(slide, 10.45, 1.62, 2.1, 0.34, "Aplicar filtros", C.blue);

  addTable(slide, {
    x: 0.55,
    y: 2.4,
    w: 12.25,
    h: 4.55,
    columns: ["Usuario", "Accion", "Modulo", "Descripcion", "Fecha", "Resultado"],
    rowCount: 10,
    headColor: C.navy,
    headText: C.white
  });

  addPill(slide, 11.5, 3.12, "OK", C.softGreen, "166534", 0.5);
  addPill(slide, 11.5, 3.57, "WARN", C.softAmber, "9A3412", 0.62);
  addPill(slide, 11.5, 4.02, "ERROR", C.softRed, "991B1B", 0.66);

  addFooterTag(slide, "Ruta: /auditoria | admin-only event log and filters");
}

function slideEntidades() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Entidades", "Gestion de entidades y configuracion por alcance");

  addSurface(slide, 0.55, 1.25, 12.25, 0.92);
  addInput(slide, 0.85, 1.43, 4.8, "Buscar entidad", "Nombre, nit o codigo");
  addButton(slide, 9.85, 1.62, 2.7, 0.34, "Crear nueva entidad", C.blue);

  const entities = [
    ["Clinica Norte", "Activos: 42", "Usuarios: 15"],
    ["Clinica Centro", "Activos: 38", "Usuarios: 12"],
    ["Hospital Sur", "Activos: 55", "Usuarios: 22"],
    ["Sede Niquia", "Activos: 30", "Usuarios: 11"],
    ["Sede Autopista", "Activos: 26", "Usuarios: 9"],
    ["Laboratorio", "Activos: 18", "Usuarios: 7"]
  ];

  entities.forEach((e, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 0.55 + col * 4.15;
    const y = 2.42 + row * 2.2;

    addSurface(slide, x, y, 3.95, 1.95);

    slide.addText(e[0], {
      x: x + 0.22,
      y: y + 0.22,
      w: 2.4,
      h: 0.2,
      fontFace: FONT,
      fontSize: 11,
      bold: true,
      color: C.ink
    });

    addPill(slide, x + 0.22, y + 0.55, e[1], "EFF6FF", "1E3A8A", 1.2);
    addPill(slide, x + 1.56, y + 0.55, e[2], "ECFDF5", "166534", 1.2);

    addButton(slide, x + 0.22, y + 1.28, 1.55, 0.32, "Configurar", C.blue);
    addButton(slide, x + 2.0, y + 1.28, 1.7, 0.32, "Ver activos", "334155");
  });

  addFooterTag(slide, "Ruta: /entidades | entity cards with operational counters");
}

function slideUsuarios() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Usuarios", "Administracion de cuentas, roles y permisos");

  addSurface(slide, 0.55, 1.25, 12.25, 0.95);
  addInput(slide, 0.85, 1.43, 3.5, "Buscar usuario", "Nombre o email");
  addInput(slide, 4.6, 1.43, 2.2, "Rol", "Todos");
  addInput(slide, 7.05, 1.43, 2.2, "Estado", "Activo");
  addButton(slide, 9.55, 1.62, 1.5, 0.34, "Filtrar", C.blue);
  addButton(slide, 11.2, 1.62, 1.6, 0.34, "Nuevo", "0F766E");

  addTable(slide, {
    x: 0.55,
    y: 2.4,
    w: 12.25,
    h: 4.55,
    columns: ["Nombre", "Email", "Rol", "Entidad", "Estado", "Ultimo acceso", "Acciones"],
    rowCount: 10
  });

  addPill(slide, 6.72, 3.12, "Admin", "FEE2E2", "991B1B", 0.68);
  addPill(slide, 6.72, 3.57, "Tecnico", "DBEAFE", "1E3A8A", 0.8);
  addPill(slide, 6.72, 4.02, "Usuario", "ECFDF5", "166534", 0.76);

  addFooterTag(slide, "Ruta: /usuarios | user list, role pills and admin actions");
}

function slideMiCuenta() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Mi cuenta", "Perfil personal, seguridad y preferencias");

  addSurface(slide, 0.55, 1.25, 12.25, 5.75);

  const tabs = ["Perfil", "Seguridad", "Actividad"];
  tabs.forEach((tab, i) => {
    addPill(
      slide,
      0.9 + i * 1.25,
      1.55,
      tab,
      i === 0 ? "DBEAFE" : "E2E8F0",
      i === 0 ? "1E3A8A" : "475569",
      1.05
    );
  });

  addInput(slide, 0.95, 2.05, 3.2, "Nombre", "Maria Perez");
  addInput(slide, 4.35, 2.05, 3.2, "Email", "maria@empresa.com");
  addInput(slide, 7.75, 2.05, 3.2, "Telefono", "+57 300 000 0000");

  addInput(slide, 0.95, 2.9, 3.2, "Rol", "Administrador");
  addInput(slide, 4.35, 2.9, 3.2, "Entidad activa", "Sede Niquia");
  addInput(slide, 7.75, 2.9, 3.2, "Zona horaria", "America/Bogota");

  addSurface(slide, 0.95, 3.8, 10.0, 2.6, 0.06, "F8FAFC");
  slide.addText("Seguridad", {
    x: 1.2,
    y: 4.05,
    w: 2.0,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  addInput(slide, 1.2, 4.35, 2.8, "Contrasena actual", "********");
  addInput(slide, 4.2, 4.35, 2.8, "Nueva contrasena", "********");
  addInput(slide, 7.2, 4.35, 2.8, "Confirmar", "********");

  addButton(slide, 10.95, 5.95, 1.55, 0.34, "Guardar", C.blue);

  addFooterTag(slide, "Ruta: /mi-cuenta | profile + security tabs");
}

function slideAyuda() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Ayuda", "Centro de soporte, FAQ y guias de uso");

  addSurface(slide, 0.55, 1.25, 12.25, 0.95);
  addInput(slide, 0.85, 1.43, 9.7, "Buscar en ayuda", "Escribe una pregunta");
  addButton(slide, 10.8, 1.62, 2.0, 0.34, "Buscar", C.blue);

  const faqs = [
    "Como registrar un activo nuevo?",
    "Como crear un mantenimiento preventivo?",
    "Como firmar una orden digital?",
    "Como cambiar la entidad activa?",
    "Como exportar PDF de hoja de vida?",
    "Como revisar auditoria de acciones?"
  ];

  faqs.forEach((faq, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 0.55 + col * 6.25;
    const y = 2.4 + row * 1.5;

    addSurface(slide, x, y, 6.0, 1.2, 0.06, C.white);
    slide.addText(faq, {
      x: x + 0.2,
      y: y + 0.2,
      w: 5.6,
      h: 0.2,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: C.ink
    });

    slide.addText("Ver articulo", {
      x: x + 0.2,
      y: y + 0.52,
      w: 1.2,
      h: 0.12,
      fontFace: FONT,
      fontSize: 8,
      color: C.blue
    });
  });

  addSurface(slide, 0.55, 6.95, 12.25, 0.3, 0.05, "EFF6FF");
  slide.addText("Soporte: soporte@assetcontrol.com | +57 604 000 0000", {
    x: 0.8,
    y: 7.03,
    w: 5.8,
    h: 0.12,
    fontFace: FONT,
    fontSize: 8,
    color: "1E3A8A"
  });

  addFooterTag(slide, "Ruta: /ayuda | faq cards + support channels");
}

function slideAcercaDe() {
  const slide = pptx.addSlide();

  addFullBg(slide, C.bg);
  addHeader(slide, "Acerca de", "Vision del producto, alcance y equipo");

  addSurface(slide, 0.55, 1.25, 12.25, 2.05, 0.08, C.white);
  slide.addText("AssetControl", {
    x: 0.9,
    y: 1.58,
    w: 2.7,
    h: 0.28,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: C.navy
  });

  slide.addText(
    "Plataforma enterprise para control de inventario, trazabilidad de mantenimientos y gestion de ordenes tecnicas.",
    {
      x: 0.9,
      y: 1.95,
      w: 10.8,
      h: 0.34,
      fontFace: FONT,
      fontSize: 10,
      color: C.muted
    }
  );

  addPill(slide, 0.9, 2.45, "Version 1.0", "DBEAFE", "1E3A8A", 1.05);
  addPill(slide, 2.1, 2.45, "React + Node", "DCFCE7", "166534", 1.25);
  addPill(slide, 3.5, 2.45, "Multi entidad", "FEE2E2", "991B1B", 1.2);

  addSurface(slide, 0.55, 3.55, 5.9, 3.4, 0.08, C.white);
  slide.addText("Valores del sistema", {
    x: 0.9,
    y: 3.85,
    w: 2.5,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  [
    "Claridad operativa",
    "Trazabilidad total",
    "Escalabilidad",
    "Seguridad por roles",
    "Diseno institucional"
  ].forEach((value, i) => {
    addSurface(slide, 0.9, 4.2 + i * 0.5, 5.2, 0.4, 0.04, "F8FAFC");
    slide.addText(value, {
      x: 1.1,
      y: 4.34 + i * 0.5,
      w: 4.8,
      h: 0.12,
      fontFace: FONT,
      fontSize: 9,
      color: C.ink
    });
  });

  addSurface(slide, 6.9, 3.55, 5.9, 3.4, 0.08, C.white);
  slide.addText("Equipo y contacto", {
    x: 7.25,
    y: 3.85,
    w: 2.5,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: C.ink
  });

  const people = ["Product owner", "Lead dev", "QA", "Soporte"];
  people.forEach((p, i) => {
    addSurface(slide, 7.25, 4.2 + i * 0.63, 5.2, 0.52, 0.04, "F8FAFC");
    slide.addText(p, {
      x: 7.48,
      y: 4.38 + i * 0.63,
      w: 2.0,
      h: 0.12,
      fontFace: FONT,
      fontSize: 9,
      bold: true,
      color: C.ink
    });
    slide.addText("assetcontrol@empresa.com", {
      x: 9.7,
      y: 4.38 + i * 0.63,
      w: 2.5,
      h: 0.12,
      fontFace: FONT,
      fontSize: 8,
      color: C.muted,
      align: "right"
    });
  });

  addFooterTag(slide, "Ruta: /acerca-de | product vision and team info");
}

slideCover();
slideLogin();
slideEntitySelector();
slideHome();
slideActivos();
slideMantenimientos();
slideCronograma();
slideOrdenes();
slideAuditoria();
slideEntidades();
slideUsuarios();
slideMiCuenta();
slideAyuda();
slideAcercaDe();

await pptx.writeFile({ fileName: "AssetControl-UI-Rutas.pptx" });
console.log("PPTX generado: AssetControl-UI-Rutas.pptx");
