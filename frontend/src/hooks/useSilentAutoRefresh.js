import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 20000;

// Refresca datos en segundo plano de forma periodica y al volver a la pestaña/ventana,
// sin mostrar loaders ni interrumpir al usuario, para que la informacion se mantenga
// al dia entre dispositivos sin depender de que alguien recargue la pagina.
export default function useSilentAutoRefresh(refreshFn, { enabled = true, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const refreshRef = useRef(refreshFn);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    refreshRef.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const tick = () => {
      if (!enabledRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        Promise.resolve(refreshRef.current?.()).catch(() => {});
      } catch {
        // Un fallo de refresco en segundo plano no debe interrumpir al usuario.
      }
    };

    const intervalId = globalThis.setInterval(tick, intervalMs);
    globalThis.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      globalThis.clearInterval(intervalId);
      globalThis.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);
}
