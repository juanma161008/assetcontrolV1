const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getFailureEvents = (historial = []) =>
  historial.filter((item) => String(item.tipo || "").toLowerCase().includes("correctivo"));

const getHoursFromMaintenance = (item) => {
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
};

export const calculateAssetKpis = (historial = []) => {
  const source = Array.isArray(historial) ? historial : [];
  const ordered = [...source].sort(
    (a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()
  );
  const failures = getFailureEvents(ordered);
  const preventivos = ordered.filter((item) =>
    String(item.tipo || "").toLowerCase().includes("preventivo")
  );
  const finalizados = ordered.filter(
    (item) => String(item.estado || "").toLowerCase() === "finalizado"
  );

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
};

export const aggregateKpis = (items = []) => {
  const numeric = (key) =>
    items.map((item) => item[key]).filter((value) => Number.isFinite(value));
  const average = (arr) =>
    arr.length ? Number((arr.reduce((sum, value) => sum + value, 0) / arr.length).toFixed(2)) : null;

  return {
    mtbf: average(numeric("mtbf")),
    mttr: average(numeric("mttr")),
    disponibilidad: average(numeric("disponibilidad")),
    oee: average(numeric("oee"))
  };
};

export const filterByPeriod = (items = [], year, monthIndex) => {
  return (Array.isArray(items) ? items : []).filter((item) => {
    const date = parseDate(item.fecha);
    if (!date) return false;
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });
};

export const formatPeriodo = (year, monthIndex) => {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}`;
};

