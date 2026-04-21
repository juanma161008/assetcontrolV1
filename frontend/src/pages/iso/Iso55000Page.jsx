import { useEffect, useMemo, useState } from "react";
import "../../styles/InfoPages.css";
import "../../styles/Iso55000.css";
import httpClient from "../../services/httpClient";
import { getCurrentUser } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";
import { ISO_55000_REQUIREMENTS, calculateLifecycle } from "../../utils/assetLifecycle";

const STATUS_SCORE = {
  "No iniciado": 0,
  "En desarrollo": 0.3,
  "Implementado": 0.6,
  "Auditado": 0.85
};
const TARGET_COMPLIANCE = 98;

export default function Iso55000Page() {
  const [activos, setActivos] = useState([]);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [isSendingReport, setIsSendingReport] = useState(false);

  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError("");
        const activosRes = await httpClient.get("/api/activos");
        let mantData = [];

        try {
          const mantRes = await httpClient.get("/api/mantenimientos");
          mantData = mantRes.data?.data || [];
        } catch (mantError) {
          const status = mantError?.response?.status;
          if (status === 401) {
            throw new Error("Sesion expirada. Por favor, inicia sesion nuevamente.");
          }
          if (status !== 403) {
            throw mantError;
          }
        }
        setActivos(activosRes.data?.data || []);
        setMantenimientos(mantData);
      } catch (err) {
        setError(err?.response?.data?.message || "No fue posible cargar los datos ISO.");
        setActivos([]);
        setMantenimientos([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const maintenanceByAsset = useMemo(() => {
    const map = new Map();
    (Array.isArray(mantenimientos) ? mantenimientos : []).forEach((item) => {
      const key = Number(item.activo_id);
      if (!Number.isFinite(key)) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [mantenimientos]);

  const isoStats = useMemo(() => {
    const assets = Array.isArray(activos) ? activos : [];
    if (!assets.length) {
      return {
        totalAssets: 0,
        averageCompliance: 0,
        requirementStats: [],
        gaps: []
      };
    }

    const requirementStats = ISO_55000_REQUIREMENTS.map((req) => {
      let implemented = 0;
      let total = 0;
      let score = 0;
      const statusMap = {
        "No iniciado": 0,
        "En desarrollo": 0,
        "Implementado": 0,
        "Auditado": 0
      };

      assets.forEach((asset) => {
        const historial = maintenanceByAsset.get(Number(asset.id)) || [];
        const iso = calculateLifecycle(asset, historial).iso;
        const requisito = iso.requisitos.find((item) => item.id === req.id);
        const estado = requisito?.estado || "No iniciado";
        statusMap[estado] = (statusMap[estado] || 0) + 1;
        if (estado === "Implementado" || estado === "Auditado") {
          implemented += 1;
        }
        score += STATUS_SCORE[estado] ?? 0;
        total += 1;
      });

      const percent = total ? Math.round((implemented / total) * 100) : 0;
      const scorePct = total ? Math.round((score / total) * 100) : 0;
      return {
        ...req,
        total,
        implemented,
        percent,
        scorePct,
        statusMap
      };
    });

    const complianceValues = requirementStats.map((stat) => stat.percent);
    const averageCompliance = complianceValues.length
      ? Math.round(complianceValues.reduce((sum, value) => sum + value, 0) / complianceValues.length)
      : 0;
    const gaps = requirementStats.filter((stat) => stat.percent < TARGET_COMPLIANCE);

    return {
      totalAssets: assets.length,
      averageCompliance,
      requirementStats,
      gaps
    };
  }, [activos, maintenanceByAsset]);

  const handleSendReport = async () => {
    try {
      setIsSendingReport(true);
      setReportStatus("");
      const response = await httpClient.post("/api/reportes/kpi", {});
      setReportStatus(response.data?.message || "Reporte KPI enviado.");
    } catch (err) {
      setReportStatus(err?.response?.data?.message || "No se pudo enviar el reporte KPI.");
    } finally {
      setIsSendingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="info-page iso-page">
        <p className="info-intro">Cargando panel ISO 55000...</p>
      </div>
    );
  }

  return (
    <div className="info-page iso-page">
      <div className="iso-header">
        <div>
          <span className="tickets-eyebrow">ISO 55000</span>
          <h1>Panel Ejecutivo ISO 55000</h1>
          <p className="tickets-subtitle">
            Evaluación automática del cumplimiento por requisito y ciclo de vida.
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn-action" onClick={handleSendReport} disabled={isSendingReport}>
            {isSendingReport ? "Enviando..." : "Enviar reporte KPI"}
          </button>
        )}
      </div>

      {reportStatus && <div className="alert">{reportStatus}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="iso-summary">
        <div className="iso-card">
          <span>Activos evaluados</span>
          <strong>{isoStats.totalAssets}</strong>
        </div>
        <div className="iso-card">
          <span>Cumplimiento global</span>
          <strong>{isoStats.averageCompliance}%</strong>
        </div>
        <div className="iso-card">
          <span>Requisitos críticos</span>
          <strong>{isoStats.gaps.length}</strong>
        </div>
      </div>

      <section className="iso-grid">
        {isoStats.requirementStats.map((stat) => (
          <article key={stat.id} className="iso-requirement-card">
            <header>
              <div>
                <small>Cláusula {stat.clause} · Automática</small>
                <h3>{stat.label}</h3>
              </div>
              <span className={`iso-chip ${stat.percent >= TARGET_COMPLIANCE ? "ok" : "warn"}`}>{stat.percent}%</span>
            </header>
            <p>{stat.description}</p>
            <div className="iso-progress">
              <span style={{ width: `${Math.min(100, stat.percent)}%` }}></span>
            </div>
            <div className="iso-status-list">
              <div>
                <strong>{stat.statusMap["Implementado"] + stat.statusMap["Auditado"]}</strong>
                <span>Implementado/Auditado</span>
              </div>
              <div>
                <strong>{stat.statusMap["En desarrollo"]}</strong>
                <span>En desarrollo</span>
              </div>
              <div>
                <strong>{stat.statusMap["No iniciado"]}</strong>
                <span>No iniciado</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      {isoStats.gaps.length > 0 && (
        <section className="iso-gaps">
          <h2>Brechas prioritarias</h2>
          <ul>
            {isoStats.gaps.map((gap) => (
              <li key={`gap-${gap.id}`}>
                <strong>{gap.label}</strong> - cumplimiento {gap.percent}%
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
