import MantenimientoPgRepository from "../../infrastructure/repositories/MantenimientoPgRepository.js";
import ActivoPgRepository from "../../infrastructure/repositories/ActivoPgRepository.js";
import { aggregateKpis, calculateAssetKpis, filterByPeriod, formatPeriodo } from "../../utils/kpi.js";

const repoMantenimiento = new MantenimientoPgRepository();
const repoActivo = new ActivoPgRepository();

const buildMaintenanceByAsset = (mantenimientos = []) => {
  const map = new Map();
  (Array.isArray(mantenimientos) ? mantenimientos : []).forEach((item) => {
    const key = Number(item.activo_id);
    if (!Number.isFinite(key) || key <= 0) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return map;
};

export const buildKpiReport = async ({ year, monthIndex } = {}) => {
  const now = new Date();
  const reportYear = Number.isInteger(year) ? year : now.getFullYear();
  const reportMonth = Number.isInteger(monthIndex) ? monthIndex : now.getMonth();

  const [activos, mantenimientos] = await Promise.all([
    repoActivo.findAll(),
    repoMantenimiento.findAll()
  ]);

  const filteredMantenimientos = filterByPeriod(mantenimientos, reportYear, reportMonth);
  const maintenanceByAsset = buildMaintenanceByAsset(filteredMantenimientos);

  const kpisByAsset = (Array.isArray(activos) ? activos : [])
    .map((activo) => {
      const historial = maintenanceByAsset.get(Number(activo.id)) || [];
      return calculateAssetKpis(historial);
    })
    .filter((item) => item.baseMantenimientos > 0);

  const global = aggregateKpis(kpisByAsset);
  const total = filteredMantenimientos.length;
  const finalizados = filteredMantenimientos.filter(
    (item) => String(item.estado || "").toLowerCase() === "finalizado"
  ).length;
  const pendientes = filteredMantenimientos.filter(
    (item) => String(item.estado || "").toLowerCase() !== "finalizado"
  ).length;

  const today = new Date();
  const backlog = filteredMantenimientos.filter((item) => {
    const fecha = new Date(item.fecha || 0);
    if (Number.isNaN(fecha.getTime())) return false;
    return fecha < today && String(item.estado || "").toLowerCase() !== "finalizado";
  }).length;

  return {
    periodo: formatPeriodo(reportYear, reportMonth),
    generado_en: new Date().toLocaleString("es-CO"),
    mtbf: global.mtbf,
    mttr: global.mttr,
    disponibilidad: global.disponibilidad,
    oee: global.oee,
    total_mantenimientos: total,
    finalizados,
    pendientes,
    backlog
  };
};

