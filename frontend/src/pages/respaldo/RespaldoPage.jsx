import { useCallback, useEffect, useState } from "react";
import httpClient from "../../services/httpClient";
import useSilentAutoRefresh from "../../hooks/useSilentAutoRefresh";

const PROVEEDOR_OPTIONS = [
  { value: "local", label: "Carpeta local" },
  { value: "onedrive", label: "OneDrive" },
  { value: "googledrive", label: "Google Drive" }
];

const formatFecha = (value) => {
  if (!value) return "Nunca se ha ejecutado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-CO");
};

export default function RespaldoPage() {
  const [carpetaDestino, setCarpetaDestino] = useState("");
  const [proveedor, setProveedor] = useState("local");
  const [habilitado, setHabilitado] = useState(false);
  const [hora, setHora] = useState("02:00");
  const [ultimaEjecucion, setUltimaEjecucion] = useState(null);
  const [ultimoOk, setUltimoOk] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const cargarConfiguracion = useCallback(async ({ withLoading = true } = {}) => {
    if (withLoading) setLoading(true);
    try {
      const response = await httpClient.get("/api/respaldo/configuracion");
      const data = response.data?.data;
      if (data) {
        setCarpetaDestino(data.carpeta_destino || "");
        setProveedor(data.proveedor || "local");
        setHabilitado(Boolean(data.habilitado));
        setHora(data.hora || "02:00");
        setUltimaEjecucion(data.ultima_ejecucion || null);
        setUltimoOk(data.ultimo_ok);
        setUltimoResultado(data.ultimo_resultado || "");
      }
    } catch (err) {
      if (withLoading) {
        setError(err?.response?.data?.message || "No se pudo cargar la configuración de respaldo.");
      }
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
  }, [cargarConfiguracion]);

  useSilentAutoRefresh(() => cargarConfiguracion({ withLoading: false }), {
    enabled: !saving && !ejecutando
  });

  const guardarConfiguracion = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (habilitado && !carpetaDestino.trim()) {
      setError("Indica la carpeta de destino para activar el respaldo diario.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await httpClient.put("/api/respaldo/configuracion", {
        carpeta_destino: carpetaDestino.trim(),
        proveedor,
        habilitado,
        hora
      });
      const data = response.data?.data;
      if (data) {
        setUltimaEjecucion(data.ultima_ejecucion || null);
        setUltimoOk(data.ultimo_ok);
        setUltimoResultado(data.ultimo_resultado || "");
      }
      setSuccess("Configuración de respaldo guardada.");
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo guardar la configuración de respaldo.");
    } finally {
      setSaving(false);
    }
  };

  const ejecutarAhora = async () => {
    if (ejecutando) return;
    if (!carpetaDestino.trim()) {
      setError("Indica la carpeta de destino antes de generar un respaldo.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setEjecutando(true);
    try {
      const response = await httpClient.post("/api/respaldo/ejecutar");
      const data = response.data?.data;
      setUltimaEjecucion(new Date().toISOString());
      setUltimoOk(data?.ok ?? true);
      setUltimoResultado(
        data?.ok
          ? `Respaldo correcto: base de datos + ${data.documentosGuardados} documento(s) en ${data.carpeta}`
          : `Respaldo con errores: ${(data?.errores || []).join(" | ")}`
      );
      setSuccess(data?.ok ? "Respaldo generado correctamente." : "Respaldo generado con errores. Revisa el detalle abajo.");
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo generar el respaldo.");
    } finally {
      setEjecutando(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">Cargando configuración de respaldo...</div>
      </div>
    );
  }

  return (
    <div className="page-content respaldo-page">
      <h1>Copia de seguridad</h1>
      <p>
        Configura dónde se guarda el respaldo diario automático de la base de datos y de los
        documentos de órdenes ya aprobadas (con las firmas del usuario habitual y del interventor).
        Apunta la carpeta a una ubicación sincronizada por OneDrive o Google Drive si quieres que el
        respaldo también quede en la nube, o deja una ruta local si prefieres guardarlo solo en este
        equipo.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={guardarConfiguracion} className="respaldo-form">
        <div className="campo">
          <label htmlFor="respaldo-proveedor">Proveedor</label>
          <select
            id="respaldo-proveedor"
            className="search-input"
            value={proveedor}
            onChange={(event) => setProveedor(event.target.value)}
          >
            {PROVEEDOR_OPTIONS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="respaldo-carpeta">Carpeta de destino</label>
          <input
            id="respaldo-carpeta"
            type="text"
            className="search-input"
            placeholder="Ej: C:\Users\tu-usuario\OneDrive\Respaldos AssetControl"
            value={carpetaDestino}
            onChange={(event) => setCarpetaDestino(event.target.value)}
          />
          <small>
            Debe ser una ruta accesible desde el computador donde corre el servidor. Si eliges
            OneDrive o Google Drive, usa la carpeta que ya tienes sincronizada por su aplicación de
            escritorio.
          </small>
        </div>

        <div className="campo">
          <label htmlFor="respaldo-hora">Hora del respaldo diario</label>
          <input
            id="respaldo-hora"
            type="time"
            className="search-input"
            value={hora}
            onChange={(event) => setHora(event.target.value)}
          />
        </div>

        <div className="campo campo-checkbox">
          <label htmlFor="respaldo-habilitado">
            <input
              id="respaldo-habilitado"
              type="checkbox"
              checked={habilitado}
              onChange={(event) => setHabilitado(event.target.checked)}
            />
            {" "}Activar respaldo diario automático
          </label>
        </div>

        <div className="respaldo-acciones">
          <button type="submit" className="btn-action" disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
          <button type="button" className="btn-action" onClick={ejecutarAhora} disabled={ejecutando}>
            {ejecutando ? "Generando respaldo..." : "Generar respaldo ahora"}
          </button>
        </div>
      </form>

      <div className="respaldo-estado">
        <h2>Último respaldo</h2>
        <p><strong>Fecha:</strong> {formatFecha(ultimaEjecucion)}</p>
        {ultimoOk !== null && (
          <p>
            <strong>Resultado:</strong>{" "}
            <span className={ultimoOk ? "texto-exito" : "texto-error"}>
              {ultimoOk ? "Correcto" : "Con errores"}
            </span>
          </p>
        )}
        {ultimoResultado && <p className="respaldo-detalle">{ultimoResultado}</p>}
      </div>
    </div>
  );
}
