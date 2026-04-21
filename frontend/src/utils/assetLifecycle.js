export const ISO_IMPLEMENTATION_STATUS = [
  "No iniciado",
  "En desarrollo",
  "Implementado",
  "Auditado"
];

export const ISO_55000_REQUIREMENTS = [
  {
    id: "contexto_organizacion",
    clause: "4",
    label: "Contexto de la organización",
    description: "Contexto organizacional y alcance del sistema de gestión de activos."
  },
  {
    id: "liderazgo",
    clause: "5",
    label: "Liderazgo y compromiso",
    description: "Compromiso de dirección, roles, responsabilidades y autoridad."
  },
  {
    id: "politica_gestion_activos",
    clause: "5.2",
    label: "Política de gestión de activos",
    description: "Política formal alineada con estrategia, ciclo de vida y valor."
  },
  {
    id: "planificacion_objetivos",
    clause: "6",
    label: "Planificación y objetivos",
    description: "Objetivos de activos, planes y recursos para su cumplimiento."
  },
  {
    id: "riesgos_oportunidades",
    clause: "6.1",
    label: "Riesgos y oportunidades",
    description: "Identificación, evaluación y tratamiento de riesgos/oportunidades."
  },
  {
    id: "apoyo",
    clause: "7",
    label: "Apoyo",
    description: "Recursos, competencia, comunicación e información documentada."
  },
  {
    id: "operacion",
    clause: "8",
    label: "Operación",
    description: "Control operacional del ciclo de vida y ejecución de actividades."
  },
  {
    id: "evaluacion_desempeno",
    clause: "9",
    label: "Evaluación del desempeño",
    description: "Seguimiento, auditoría y revisión de desempeño de activos."
  },
  {
    id: "mejora_continua",
    clause: "10",
    label: "Mejora continua",
    description: "Acciones correctivas, lecciones aprendidas y mejora permanente."
  }
];

// Compatibilidad con codigo previo.
export const ISO_55000_RULES = ISO_55000_REQUIREMENTS;

const ISO_REQUIREMENT_IDS = new Set(ISO_55000_REQUIREMENTS.map((item) => item.id));

function safeValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value).trim();
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value) {
  if (!value) return "-";
  const date = parseDate(value);
  if (!date) return safeValue(value);
  return date.toLocaleDateString("es-CO");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAgeInYears(date) {
  if (!date) return null;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    years -= 1;
  }
  return years < 0 ? 0 : years;
}

function normalizeRequirementStatus(value) {
  const status = String(value || "").trim();
  if (ISO_IMPLEMENTATION_STATUS.includes(status)) {
    return status;
  }
  return "No iniciado";
}

function normalizeRequirement(requirement = {}) {
  const id = String(requirement.id || "").trim();
  const definition = ISO_55000_REQUIREMENTS.find((item) => item.id === id);
  if (!definition) return null;

  return {
    id: definition.id,
    clause: definition.clause,
    label: definition.label,
    description: definition.description,
    estado: normalizeRequirementStatus(requirement.estado || requirement.status),
    evidencia: safeValue(requirement.evidencia, ""),
    responsable: safeValue(requirement.responsable, ""),
    fecha_revision: safeValue(requirement.fecha_revision, ""),
    metodo: safeValue(requirement.metodo, "automatico")
  };
}

export function buildDefaultIsoModel() {
  return {
    version: "iso-55000-2024",
    politica_gestion_activos: "",
    riesgos_oportunidades: "",
    objetivos_estrategicos: "",
    requisitos: ISO_55000_REQUIREMENTS.map((item) => ({
      id: item.id,
      clause: item.clause,
      label: item.label,
      description: item.description,
      estado: "No iniciado",
      evidencia: "",
      responsable: "",
      fecha_revision: "",
      metodo: "automatico"
    }))
  };
}

export function normalizeIsoModel(value) {
  const defaultModel = buildDefaultIsoModel();

  // Compatibilidad con version previa (array tipo checklist).
  if (Array.isArray(value)) {
    const selected = new Set(value.map((item) => String(item).trim()).filter((item) => ISO_REQUIREMENT_IDS.has(item)));
    return {
      ...defaultModel,
      requisitos: defaultModel.requisitos.map((item) => ({
        ...item,
        estado: selected.has(item.id) ? "Implementado" : "No iniciado"
      }))
    };
  }
  const source = value && typeof value === "object" ? value : {};
  const requisitosSource = Array.isArray(source.requisitos) ? source.requisitos : [];

  const requisitosById = requisitosSource.reduce((acc, requirement) => {
    const normalized = normalizeRequirement(requirement);
    if (normalized) {
      acc[normalized.id] = normalized;
    }
    return acc;
  }, {});

  return {
    ...defaultModel,
    version: safeValue(source.version, defaultModel.version),
    politica_gestion_activos: safeValue(source.politica_gestion_activos, ""),
    riesgos_oportunidades: safeValue(source.riesgos_oportunidades, ""),
    objetivos_estrategicos: safeValue(source.objetivos_estrategicos, ""),
    requisitos: defaultModel.requisitos.map((item) => requisitosById[item.id] || item)
  };
}

// Compatibilidad con tests/codigo anterior.
export function normalizeIsoRules(values = []) {
  const model = normalizeIsoModel(values);
  return model.requisitos
    .filter((item) => item.estado === "Implementado" || item.estado === "Auditado")
    .map((item) => item.id);
}

export function buildSuggestedAssetPolicy(asset = {}) {
  const entidad = safeValue(asset.sede || asset.entidad || "MICROCINCO & CIA LTDA", "MICROCINCO & CIA LTDA");
  const equipo = safeValue(asset.equipo || asset.activo || "activos tecnologicos", "activos tecnologicos");
  return [
    `${entidad} establece la politica de gestion de activos para asegurar valor sostenible durante el ciclo de vida de ${equipo}.`,
    "Se garantiza trazabilidad tecnica, financiera y operativa mediante control centralizado, mantenimiento planificado y mejora continua.",
    `La politica aplica a todas las sedes y procesos de ${entidad}, con enfoque en confiabilidad, disponibilidad, riesgo y cumplimiento ISO 55000.`
  ].join(" ");
}

function resolveLifecycleReferenceDate(asset = {}) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  return parseDate(sourceAsset.fecha_adquisicion) || parseDate(sourceAsset.created_at) || parseDate(sourceAsset.updated_at);
}

function getHistorySignals(historial = []) {
  const source = Array.isArray(historial) ? historial : [];
  const preventivos = source.filter((item) => String(item.tipo || "").toLowerCase().includes("preventivo"));
  const correctivos = source.filter((item) => String(item.tipo || "").toLowerCase().includes("correctivo"));
  const finalizados = source.filter((item) => String(item.estado || "").toLowerCase() === "finalizado");
  const tecnicos = source.filter((item) => hasMeaningfulText(item.tecnico, 3));

  return {
    source,
    count: source.length,
    preventiveCount: preventivos.length,
    correctiveCount: correctivos.length,
    finalizedCount: finalizados.length,
    technicianCount: tecnicos.length
  };
}

function getScoreFromFlags(flags = []) {
  const source = Array.isArray(flags) ? flags : [];
  if (!source.length) return 0;
  return source.filter(Boolean).length / source.length;
}

function inferLifecycleStage(asset = {}, remainingYears = null) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const declaredStage = String(sourceAsset.ciclo_vida_etapa || "").trim();
  if (declaredStage) {
    return declaredStage;
  }

  const normalizedState = String(sourceAsset.estado || "").toLowerCase();
  if (normalizedState.includes("fuera") || normalizedState.includes("baja") || normalizedState.includes("retir")) {
    return "Retirado";
  }

  if (remainingYears !== null) {
    if (remainingYears <= 0) return "Renovacion";
    if (remainingYears <= 1) return "Fin de vida";
    if (remainingYears <= 2) return "Seguimiento";
  }

  return "Operacion";
}

export function buildSuggestedIsoRisks(asset = {}, historial = []) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const history = Array.isArray(historial) ? historial : [];
  const equipo = safeValue(sourceAsset.equipo || sourceAsset.activo || sourceAsset.nombre || "el activo", "el activo");
  const entidad = safeValue(sourceAsset.sede || sourceAsset.entidad || "la organizacion", "la organizacion");
  const criticidad = safeValue(sourceAsset.criticidad || "media", "media");
  const referenceDate = resolveLifecycleReferenceDate(sourceAsset);
  const age = getAgeInYears(referenceDate);
  const ageText = Number.isFinite(age)
    ? `antiguedad estimada de ${age} anios`
    : "sin fecha formal de adquisicion";
  const preventivos = history.filter((item) => String(item.tipo || "").toLowerCase().includes("preventivo")).length;
  const correctivos = history.filter((item) => String(item.tipo || "").toLowerCase().includes("correctivo")).length;

  return [
    `Riesgos y oportunidades para ${equipo} en ${entidad}: obsolescencia, dependencia de soporte del fabricante, fallas repetitivas y continuidad del servicio.`,
    `La criticidad ${criticidad} y la ${ageText} se controlan con seguimiento automatico, mantenimientos preventivos y renovacion priorizada.`,
    history.length
      ? `El historico incluye ${preventivos} preventivos y ${correctivos} correctivos, suficiente para activar tratamiento automatico del riesgo.`
      : "Si no hay historico, el sistema propone un plan de inspeccion y mantenimiento base para cerrar la brecha documental."
  ].join(" ");
}

export function buildSuggestedIsoObjectives(asset = {}, historial = []) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const history = Array.isArray(historial) ? historial : [];
  const equipo = safeValue(sourceAsset.equipo || sourceAsset.activo || sourceAsset.nombre || "el activo", "el activo");
  const activeHistory = history.length > 0;
  const correctiveCount = history.filter((item) => String(item.tipo || "").toLowerCase().includes("correctivo")).length;

  return [
    `Objetivos automaticos para ${equipo}: mantener disponibilidad, reducir correctivos, documentar trazabilidad del ciclo de vida y asegurar decisiones de renovacion basadas en datos.`,
    activeHistory
      ? "El historico ya permite medir MTBF, MTTR y cierre de mantenimientos."
      : "Cuando no hay historico suficiente, la plataforma propone arrancar con un plan preventivo y un registro minimo de evidencias.",
    correctiveCount > 0
      ? "Los correctivos detectados alimentan acciones de mejora continua y renovacion priorizada."
      : "La ausencia de correctivos se toma como linea base para seguimiento proactivo."
  ].join(" ");
}

function hasMeaningfulText(value = "", minLength = 20) {
  return String(value || "").trim().length >= minLength;
}

function getFailureEvents(historial = []) {
  return historial.filter((item) => String(item.tipo || "").toLowerCase().includes("correctivo"));
}

function getHoursFromMaintenance(item) {
  const candidates = [
    item.duracion_horas,
    item.horas_trabajo,
    item.tiempo_resolucion_horas
  ];

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  return String(item.tipo || "").toLowerCase().includes("correctivo") ? 4 : 2;
}

export function calculateAssetKpis(historial = []) {
  const source = Array.isArray(historial) ? historial : [];
  const ordered = [...source].sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  const failures = getFailureEvents(ordered);
  const preventivos = ordered.filter((item) => String(item.tipo || "").toLowerCase().includes("preventivo"));
  const finalizados = ordered.filter((item) => String(item.estado || "").toLowerCase() === "finalizado");

  let mtbfDays = null;
  if (failures.length >= 2) {
    const intervals = [];
    for (let i = 1; i < failures.length; i += 1) {
      const prevDate = parseDate(failures[i - 1].fecha);
      const nextDate = parseDate(failures[i].fecha);
      if (!prevDate || !nextDate) continue;
      const diff = (nextDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length) {
      mtbfDays = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    }
  }

  let mttrHours = null;
  if (failures.length) {
    const repairHours = failures.map((item) => getHoursFromMaintenance(item));
    mttrHours = repairHours.reduce((sum, value) => sum + value, 0) / repairHours.length;
  }

  let disponibilidad = null;
  if (mtbfDays && mttrHours) {
    const mtbfHours = mtbfDays * 24;
    disponibilidad = (mtbfHours / (mtbfHours + mttrHours)) * 100;
  }
  const rendimiento = preventivos.length
    ? (finalizados.length / preventivos.length) * 100
    : null;
  const calidad = ordered.length ? (finalizados.length / ordered.length) * 100 : null;

  let oee = null;
  if (disponibilidad !== null && rendimiento !== null && calidad !== null) {
    oee = (disponibilidad * rendimiento * calidad) / 10000;
  }
  const round = (value) => (value === null ? null : Number(value.toFixed(2)));

  return {
    mtbf: round(mtbfDays),
    mttr: round(mttrHours),
    disponibilidad: round(disponibilidad),
    oee: round(oee),
    baseMantenimientos: ordered.length
  };
}

function getAutomaticStatus(index) {
  if (index >= 0.8) return "Auditado";
  if (index >= 0.45) return "Implementado";
  if (index >= 0.2) return "En desarrollo";
  return "No iniciado";
}

function getProgressiveTextScore(value, highThreshold, mediumThreshold, mediumScore) {
  if (hasMeaningfulText(value, highThreshold)) return 1;
  if (hasMeaningfulText(value, mediumThreshold)) return mediumScore;
  return 0;
}

function autoAssessRequirement(requirementId, asset, historial, isoModel, kpis, assistedTexts = {}) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const sourceHistorial = Array.isArray(historial) ? historial : [];
  const historySignals = getHistorySignals(sourceHistorial);
  const lifecycleReferenceDate = resolveLifecycleReferenceDate(sourceAsset);
  const ageYears = getAgeInYears(lifecycleReferenceDate);
  const declaredLifeYears = Number(sourceAsset.vida_util_anios || 0);
  const remainingYears = declaredLifeYears > 0 && typeof ageYears === "number"
    ? Math.max(declaredLifeYears - ageYears, 0)
    : null;
  const lifecycleStage = inferLifecycleStage(sourceAsset, remainingYears);
  const policyText = assistedTexts.politica || buildSuggestedAssetPolicy(sourceAsset);
  const risksText = assistedTexts.riesgos || buildSuggestedIsoRisks(sourceAsset, sourceHistorial);
  const objectivesText = assistedTexts.objetivos || buildSuggestedIsoObjectives(sourceAsset, sourceHistorial);
  const hasLocation = Boolean(
    hasMeaningfulText(sourceAsset.sede, 3) ||
    hasMeaningfulText(sourceAsset.entidad, 3) ||
    (Number.isFinite(Number(sourceAsset.entidad_id)) && Number(sourceAsset.entidad_id) > 0)
  );
  const hasArea = Boolean(hasMeaningfulText(sourceAsset.areaPrincipal, 3) || hasMeaningfulText(sourceAsset.areaSecundaria, 3));
  const hasIdentity = Boolean(
    hasMeaningfulText(sourceAsset.activo, 3) ||
    hasMeaningfulText(sourceAsset.equipo, 3) ||
    hasMeaningfulText(sourceAsset.serial, 3)
  );
  const hasResponsible = Boolean(hasMeaningfulText(sourceAsset.nombre, 3) || historySignals.technicianCount > 0);
  const hasLifecycleTrace = Boolean(lifecycleReferenceDate || declaredLifeYears > 0 || hasMeaningfulText(sourceAsset.ciclo_vida_etapa, 3));
  const hasPerformanceEvidence = Boolean(kpis.mtbf !== null || kpis.mttr !== null || kpis.oee !== null || historySignals.count > 0);

  const evidence = (() => {
    switch (requirementId) {
      case "contexto_organizacion":
        return `Se valido sede, areas, identidad del activo y trazabilidad del ciclo de vida para ${safeValue(sourceAsset.equipo || sourceAsset.activo || sourceAsset.nombre || "el activo", "el activo")}.`;
      case "liderazgo":
        return `Se detecto responsable o tecnico asociado, junto con historial operativo y estado actual del activo.`;
      case "politica_gestion_activos":
        return policyText;
      case "planificacion_objetivos":
        return `Ciclo de vida ${lifecycleStage} con vida util ${declaredLifeYears > 0 ? declaredLifeYears : "no declarada"} y referencia ${lifecycleReferenceDate ? formatDate(lifecycleReferenceDate) : "inferida"}.`;
      case "riesgos_oportunidades":
        return risksText;
      case "apoyo":
        return `Soporte documentado con ${historySignals.count} mantenimientos, ${historySignals.technicianCount} registros de tecnico y trazabilidad de activo.`;
      case "operacion":
        return `Operacion sustentada por ${historySignals.count} eventos de mantenimiento${historySignals.preventiveCount ? `, incluidos ${historySignals.preventiveCount} preventivos` : ""}.`;
      case "evaluacion_desempeno":
        return `KPIs automaticos ${kpis.mtbf !== null ? `MTBF ${kpis.mtbf} d` : ""}${kpis.mttr !== null ? `, MTTR ${kpis.mttr} h` : ""}${kpis.oee !== null ? `, OEE ${kpis.oee}%` : ""}.`;
      case "mejora_continua":
        return `Mejora continua respaldada por ${historySignals.preventiveCount} preventivos, ${historySignals.correctiveCount} correctivos y evidencia documental automatica.`;
      default:
        return objectivesText;
    }
  })();

  const scoreByRequirement = {
    contexto_organizacion: getScoreFromFlags([hasLocation, hasArea, hasIdentity, hasLifecycleTrace]),
    liderazgo: getScoreFromFlags([hasResponsible, historySignals.count > 0, historySignals.finalizedCount > 0, hasIdentity]),
    politica_gestion_activos: getProgressiveTextScore(policyText, 60, 20, 0.7),
    planificacion_objetivos: getScoreFromFlags([hasLifecycleTrace, declaredLifeYears > 0, typeof ageYears === "number", hasIdentity, hasArea]),
    riesgos_oportunidades: getProgressiveTextScore(risksText, 60, 20, 0.7),
    apoyo: getScoreFromFlags([hasResponsible, historySignals.count > 0, hasLocation, hasIdentity, hasLifecycleTrace]),
    operacion: getScoreFromFlags([historySignals.count > 0, historySignals.preventiveCount > 0, hasLifecycleTrace, hasIdentity]),
    evaluacion_desempeno: getScoreFromFlags([hasPerformanceEvidence, historySignals.count > 0, hasLifecycleTrace, hasIdentity, hasMeaningfulText(sourceAsset.estado, 3)]),
    mejora_continua: getScoreFromFlags([historySignals.preventiveCount > 0, historySignals.correctiveCount > 0, hasPerformanceEvidence, hasLifecycleTrace, hasMeaningfulText(policyText, 20)])
  };

  const score = scoreByRequirement[requirementId];
  if (score === undefined) {
    return { estado: "No iniciado", evidencia: "" };
  }

  return {
    estado: getAutomaticStatus(score),
    evidencia: evidence
  };
}

export function buildAutomaticIsoAssessment(asset = {}, historial = [], sourceModel = null, sourceKpis = null) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const sourceHistorial = Array.isArray(historial) ? historial : [];
  const isoModel = normalizeIsoModel(sourceModel || sourceAsset.iso55000_reglas);
  const kpis = sourceKpis || calculateAssetKpis(sourceHistorial);
  const generatedAt = new Date().toISOString();
  const assistedTexts = {
    politica: hasMeaningfulText(isoModel.politica_gestion_activos, 20)
      ? isoModel.politica_gestion_activos
      : buildSuggestedAssetPolicy(sourceAsset),
    riesgos: hasMeaningfulText(isoModel.riesgos_oportunidades, 20)
      ? isoModel.riesgos_oportunidades
      : buildSuggestedIsoRisks(sourceAsset, sourceHistorial),
    objetivos: hasMeaningfulText(isoModel.objetivos_estrategicos, 20)
      ? isoModel.objetivos_estrategicos
      : buildSuggestedIsoObjectives(sourceAsset, sourceHistorial)
  };

  const requisitos = ISO_55000_REQUIREMENTS.map((definition) => {
    const prev = isoModel.requisitos.find((item) => item.id === definition.id) || {};
    const assessed = autoAssessRequirement(definition.id, sourceAsset, sourceHistorial, isoModel, kpis, assistedTexts);

    return {
      ...definition,
      estado: assessed.estado,
      evidencia: prev.evidencia || prev.description || assessed.evidencia || "",
      responsable: prev.responsable || sourceAsset.nombre || "",
      fecha_revision: prev.fecha_revision || generatedAt.slice(0, 10),
      metodo: "automatico"
    };
  });

  return {
    ...isoModel,
    requisitos
  };
}

export function calculateLifecycle(asset = {}, historial = []) {
  const sourceAsset = asset && typeof asset === "object" ? asset : {};
  const sourceHistorial = Array.isArray(historial) ? historial : [];
  const fechaAdquisicion = parseDate(sourceAsset.fecha_adquisicion);
  const fechaReferencia = fechaAdquisicion || resolveLifecycleReferenceDate(sourceAsset);
  const vidaUtil = Number(sourceAsset.vida_util_anios || 0);
  const edad = getAgeInYears(fechaReferencia);
  const kpis = calculateAssetKpis(sourceHistorial);
  const iso = buildAutomaticIsoAssessment(sourceAsset, sourceHistorial, sourceAsset.iso55000_reglas, kpis);

  let restante = null;
  if (vidaUtil > 0 && typeof edad === "number") {
    restante = Math.max(vidaUtil - edad, 0);
  }

  const etapa = inferLifecycleStage(sourceAsset, restante);

  const implementadas = iso.requisitos.filter((item) => item.estado === "Implementado" || item.estado === "Auditado").length;
  const reglasCumplidas = iso.requisitos
    .filter((item) => item.estado === "Implementado" || item.estado === "Auditado")
    .map((item) => item.id);
  const cumplimiento = iso.requisitos.length ? Math.round((implementadas / iso.requisitos.length) * 100) : 0;

  return {
    etapa: safeValue(etapa),
    criticidad: safeValue(sourceAsset.criticidad),
    fechaAdquisicion,
    fechaAdquisicionTexto: formatDate(sourceAsset.fecha_adquisicion),
    fechaReferencia,
    fechaReferenciaTexto: formatDate(fechaReferencia),
    fechaReferenciaEsInferida: Boolean(fechaReferencia && !fechaAdquisicion),
    vidaUtil: vidaUtil > 0 ? vidaUtil : null,
    edad: typeof edad === "number" ? edad : null,
    restante,
    cumplimiento,
    implementadas,
    totalReglas: iso.requisitos.length,
    reglasCumplidas,
    iso,
    kpis
  };
}

export function buildAssetLifeSheetData(asset = {}, historial = [], entidadNombre = "") {
  const lifecycle = calculateLifecycle(asset, historial);
  const numero = asset.activo || asset.nombre || `ACTIVO #${asset.id || "-"}`;
  const mantenimientos = Array.isArray(historial) ? historial : [];

  return {
    generatedAt: new Date().toISOString(),
    activo: {
      id: asset.id ?? null,
      numero: safeValue(numero),
      numeroActivo: safeValue(asset.activo),
      codigo: safeValue(asset.activo),
      equipo: safeValue(asset.equipo),
      marca: safeValue(asset.marca),
      modelo: safeValue(asset.modelo),
      serial: safeValue(asset.serial),
      procesador: safeValue(asset.procesador),
      ram: safeValue([asset.tipoRam || asset.tiporam, asset.ram].filter(Boolean).join(" ")),
      tipoDisco: safeValue(asset.tipoDisco || asset.tipodisco),
      capacidadDisco: safeValue(asset.hdd),
      sistemaOperativo: safeValue(asset.os),
      areaPrincipal: safeValue(asset.areaPrincipal || asset.areaprincipal),
      areaSecundaria: safeValue(asset.areaSecundaria || asset.areasecundaria),
      responsable: safeValue(asset.nombre),
      entidad: safeValue(entidadNombre || asset.sede),
      estado: safeValue(asset.estado),
      fechaRegistro: formatDate(asset.created_at),
      fechaActualizacion: formatDate(asset.updated_at)
    },
    lifecycle,
    iso: lifecycle.iso,
    kpis: lifecycle.kpis,
    mantenimientos: mantenimientos.map((item) => ({
      id: item.id ?? null,
      fecha: formatDate(item.fecha),
      tipo: safeValue(item.tipo),
      tecnico: safeValue(item.tecnico),
      estado: safeValue(item.estado),
      descripcion: safeValue(item.descripcion)
    }))
  };
}

export function buildAssetLifeSheetHtml(data = {}) {
  const sheetData = buildAssetLifeSheetData(data.asset, data.historial, data.entidadNombre);
  const lifecycle = sheetData.lifecycle;
  const logos = data.logos || {};

  const logoM5 = safeValue(logos.logoM5, "");
  const logoAssetControl = safeValue(logos.logoAssetControl, "");

  const maintRows = sheetData.mantenimientos.length
    ? sheetData.mantenimientos
        .map(
          (item) => `
          <tr>
            <td>${escapeHtml(item.fecha)}</td>
            <td>${escapeHtml(item.tipo)}</td>
            <td>${escapeHtml(item.tecnico)}</td>
            <td>${escapeHtml(item.estado)}</td>
            <td>${escapeHtml(item.descripcion)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5">Sin mantenimientos registrados</td></tr>`;

  const activosRows = [
    ["ID", sheetData.activo.id ?? "-"],
    ["Numero de activo", sheetData.activo.numeroActivo],
    ["Equipo", sheetData.activo.equipo],
    ["Marca", sheetData.activo.marca],
    ["Modelo", sheetData.activo.modelo],
    ["Serial", sheetData.activo.serial],
    ["Procesador", sheetData.activo.procesador],
    ["RAM", sheetData.activo.ram],
    ["Tipo de disco", sheetData.activo.tipoDisco],
    ["Capacidad disco", sheetData.activo.capacidadDisco],
    ["Sistema operativo", sheetData.activo.sistemaOperativo],
    ["Area principal", sheetData.activo.areaPrincipal],
    ["Area secundaria", sheetData.activo.areaSecundaria],
    ["Entidad / sede", sheetData.activo.entidad],
    ["Nombre del equipo", sheetData.activo.responsable],
    ["Estado", sheetData.activo.estado],
    ["Fecha de registro", sheetData.activo.fechaRegistro],
    ["Fecha actualizacion", sheetData.activo.fechaActualizacion]
  ]
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value ?? "-")}</td></tr>`
    )
    .join("");

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Hoja de vida - ${escapeHtml(sheetData.activo.numero)}</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        margin: 20px;
        color: #1f2937;
      }
      .sheet-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }
      .sheet-actions button {
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .btn-print {
        background: #021F59;
        color: #ffffff;
      }
      .btn-download {
        background: #023059;
        color: #ffffff;
      }
      .brand-header {
        display: grid;
        grid-template-columns: 120px 1fr 160px;
        align-items: center;
        gap: 12px;
        border: 2px solid #021F59;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .brand-header img {
        max-width: 100%;
        max-height: 56px;
        object-fit: contain;
      }
      .header-title h1 {
        margin: 0 0 4px;
        color: #021F59;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 0 20px;
      }
      .card {
        border: 1px solid #dbe3f0;
        border-radius: 8px;
        padding: 10px;
        background: #F2F2F2;
      }
      .label {
        font-size: 12px;
        color: #4b5563;
        text-transform: none;
      }
      .value {
        font-size: 14px;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #d6deea;
        padding: 8px;
        font-size: 12px;
        text-align: left;
      }
      th {
        background: #021F59;
        color: #fff;
      }
      h2 {
        margin: 20px 0 6px;
        color: #021F59;
      }
      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: #475569;
      }
      @media print {
        body {
          margin: 8px;
        }
        .sheet-actions {
          display: none !important;
        }
      }
    </style>
    <script>
      function imprimirHojaVida() {
        globalThis.print();
      }

      function descargarHojaVidaPdf() {
        globalThis.print();
        setTimeout(function () {
          alert("En la ventana de impresion selecciona 'Guardar como PDF'.");
        }, 200);
      }
    </script>
  </head>
  <body>
    <div class="sheet-actions">
      <button type="button" class="btn-print" onclick="imprimirHojaVida()">IMPRIMIR</button>
      <button type="button" class="btn-download" onclick="descargarHojaVidaPdf()">DESCARGAR PDF</button>
    </div>

    <section class="brand-header">
      <img src="${escapeHtml(logoM5)}" alt="MICROCINCO" />
      <div class="header-title">
        <h1>Hoja de Vida del Activo</h1>
        <div>Numero de activo: ${escapeHtml(sheetData.activo.numeroActivo)}</div>
        <div>Fecha de emision: ${escapeHtml(formatDate(sheetData.generatedAt))}</div>
      </div>
      <img src="${escapeHtml(logoAssetControl)}" alt="AssetControl" />
    </section>

    <h2>Informacion completa del Activo</h2>
    <table>
      <tbody>
        ${activosRows}
      </tbody>
    </table>

    <h2>Ciclo de Vida del Equipo</h2>
    <table>
      <tbody>
        <tr><th>Etapa</th><td>${escapeHtml(lifecycle.etapa)}</td></tr>
        <tr><th>Fecha adquisicion</th><td>${escapeHtml(lifecycle.fechaAdquisicionTexto)}</td></tr>
        <tr><th>Vida util</th><td>${escapeHtml(lifecycle.vidaUtil ?? "-")}</td></tr>
        <tr><th>Edad actual</th><td>${escapeHtml(lifecycle.edad ?? "-")}</td></tr>
        <tr><th>Vida util restante</th><td>${escapeHtml(lifecycle.restante ?? "-")}</td></tr>
      </tbody>
    </table>

    <h2>Historico de Mantenimientos</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Técnico</th>
          <th>Estado</th>
          <th>Descripcion</th>
        </tr>
      </thead>
      <tbody>${maintRows}</tbody>
    </table>

    <p class="footer">
      Documento generado automaticamente por AssetControl para toma de decisiones del ciclo de vida.
    </p>
  </body>
</html>
  `.trim();
}



