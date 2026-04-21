import PptxGenJS from "pptxgenjs";
import { writeFile } from "node:fs/promises";

const pptx = new PptxGenJS();

pptx.layout = "LAYOUT_WIDE";
pptx.author = "AssetControl";
pptx.company = "AssetControl";
pptx.subject = "UI System";
pptx.title = "AssetControl UI";

const COLORS = {
  navy: "021F59",
  blue: "021E73",
  red: "F21326",
  bg: "F5F7FA",
  white: "FFFFFF",
  border: "E2E8F0",
  text: "0F172A",
  muted: "64748B",
  success: "10B981",
  warning: "F59E0B",
  danger: "EF4444",
  info: "3B82F6"
};

const FONT = "Calibri";

function background(slide, color = COLORS.bg) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color },
    line: { color }
  });
}

function header(slide, title) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.9,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy }
  });

  slide.addText("AssetControl", {
    x: 0.4,
    y: 0.25,
    w: 2.3,
    h: 0.2,
    fontFace: FONT,
    fontSize: 18,
    bold: true,
    color: COLORS.white
  });

  slide.addText(title, {
    x: 3,
    y: 0.25,
    w: 6.0,
    h: 0.2,
    fontFace: FONT,
    fontSize: 16,
    bold: true,
    color: COLORS.white
  });
}

function kpi(slide, x, title, value, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y: 1.4,
    w: 3,
    h: 1.3,
    rectRadius: 0.1,
    fill: { color: COLORS.white },
    line: { color: COLORS.border }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x,
    y: 1.4,
    w: 0.1,
    h: 1.3,
    fill: { color },
    line: { color }
  });

  slide.addText(title, {
    x: x + 0.2,
    y: 1.55,
    w: 2.6,
    h: 0.15,
    fontFace: FONT,
    fontSize: 11,
    color: COLORS.muted
  });

  slide.addText(String(value), {
    x: x + 0.2,
    y: 1.9,
    w: 2.6,
    h: 0.3,
    fontFace: FONT,
    fontSize: 26,
    bold: true,
    color: COLORS.text
  });
}

function table(slide, y) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y,
    w: 12.1,
    h: 4,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.border }
  });

  slide.addText("ID | Equipo | Estado | Ubicacion | Responsable | Acciones", {
    x: 0.9,
    y: y + 0.3,
    w: 10.5,
    h: 0.15,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    color: COLORS.text
  });
}

function dashboard() {
  const slide = pptx.addSlide();

  background(slide);
  header(slide, "Dashboard de Activos");

  kpi(slide, 0.6, "Total Activos", 128, COLORS.info);
  kpi(slide, 3.8, "Disponibles", 96, COLORS.success);
  kpi(slide, 7.0, "En Mantenimiento", 18, COLORS.warning);
  kpi(slide, 10.2, "Fuera de Servicio", 14, COLORS.danger);

  slide.addText("Resumen del sistema", {
    x: 0.7,
    y: 3.2,
    w: 2.4,
    h: 0.2,
    fontFace: FONT,
    fontSize: 14,
    bold: true,
    color: COLORS.text
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 3.5,
    w: 6,
    h: 3,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.border }
  });

  slide.addText("Pendientes de la semana", {
    x: 7,
    y: 3.2,
    w: 3.0,
    h: 0.2,
    fontFace: FONT,
    fontSize: 14,
    bold: true,
    color: COLORS.text
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 7,
    y: 3.5,
    w: 5.7,
    h: 3,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.border }
  });
}

function activos() {
  const slide = pptx.addSlide();

  background(slide);
  header(slide, "Gestion de Activos");
  table(slide, 1.4);
}

function mantenimientos() {
  const slide = pptx.addSlide();

  background(slide);
  header(slide, "Mantenimientos");
  table(slide, 1.4);
}

function admin() {
  const slide = pptx.addSlide();

  background(slide);
  header(slide, "Administracion");

  slide.addText("Usuarios | Entidades | Auditoria", {
    x: 0.8,
    y: 1.5,
    w: 4.5,
    h: 0.2,
    fontFace: FONT,
    fontSize: 14,
    color: COLORS.text
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 2,
    w: 12.1,
    h: 4,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.border }
  });
}

dashboard();
activos();
mantenimientos();
admin();

const buffer = await pptx.write({ outputType: "nodebuffer" });
await writeFile("AssetControl-UI-compatible.pptx", buffer);

console.log("PPT generado: AssetControl-UI-compatible.pptx");
