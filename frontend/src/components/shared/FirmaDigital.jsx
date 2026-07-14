import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getCanvasPoint, getDrawingPoints } from "./firmaDigital.utils";
import "../../styles/firma.css";

const supportsPointerEvents = typeof globalThis.PointerEvent !== "undefined";

export default function FirmaDigital({ value, onChange, disabled, label }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const hasDrawnRef = useRef(Boolean(value));
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  const markHasDrawn = () => {
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  };

  const releasePointerCapture = useCallback((pointerId) => {
    const canvas = canvasRef.current;
    if (!canvas || pointerId == null || typeof canvas.releasePointerCapture !== "function") {
      return;
    }

    try {
      if (typeof canvas.hasPointerCapture === "function" && !canvas.hasPointerCapture(pointerId)) {
        return;
      }
      canvas.releasePointerCapture(pointerId);
    } catch {
      // Some browsers throw if the capture already ended.
    }
  }, []);

  const clearCanvas = useCallback(
    (emit = true) => {
      drawingRef.current = false;
      releasePointerCapture(activePointerIdRef.current);
      activePointerIdRef.current = null;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      setHasDrawn(false);

      if (emit) {
        onChange("");
      }
    },
    [onChange, releasePointerCapture]
  );

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = globalThis.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (!width || !height) return;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.clearRect(0, 0, width, height);

    if (value) {
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
      };
      image.src = value;
    }
  }, [value]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    globalThis.addEventListener("resize", onResize);
    return () => globalThis.removeEventListener("resize", onResize);
  }, [setupCanvas]);

  useEffect(() => {
    const hasValue = Boolean(value);
    hasDrawnRef.current = hasValue;
    setupCanvas();
    if (typeof globalThis.requestAnimationFrame === "function") {
      const frameId = globalThis.requestAnimationFrame(() => setHasDrawn(hasValue));
      return () => {
        globalThis.cancelAnimationFrame(frameId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => setHasDrawn(hasValue), 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, [value, setupCanvas]);

  useEffect(
    () => () => {
      drawingRef.current = false;
      releasePointerCapture(activePointerIdRef.current);
      activePointerIdRef.current = null;
    },
    [releasePointerCapture]
  );

  const startDrawing = (event) => {
    if (disabled) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (supportsPointerEvents && typeof event.pointerId === "number") {
      activePointerIdRef.current = event.pointerId;
      if (typeof canvas.setPointerCapture === "function") {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a best-effort enhancement.
        }
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawingRef.current = true;

    const pointSource = getDrawingPoints(event)[0] ?? event;
    const point = getCanvasPoint(pointSource, canvas);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    // Ensure a single tap or pen touch leaves a visible trace.
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
    markHasDrawn();
  };

  const draw = (event) => {
    if (disabled || !drawingRef.current) return;

    if (supportsPointerEvents && typeof event.pointerId === "number") {
      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
    }

    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = getDrawingPoints(event);
    const sourcePoints = points.length > 0 ? points : [event];

    let hasSegment = false;
    sourcePoints.forEach((pointSource) => {
      const point = getCanvasPoint(pointSource, canvas);
      ctx.lineTo(point.x, point.y);
      hasSegment = true;
    });

    if (hasSegment) {
      ctx.stroke();
    }

    markHasDrawn();
  };

  const stopDrawing = (event) => {
    if (disabled || !drawingRef.current) return;

    if (supportsPointerEvents && typeof event?.pointerId === "number") {
      const activePointerId = activePointerIdRef.current;
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
    }

    drawingRef.current = false;

    if (typeof activePointerIdRef.current === "number") {
      releasePointerCapture(activePointerIdRef.current);
    }
    activePointerIdRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.closePath();

    if (hasDrawnRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const canvasProps = supportsPointerEvents
    ? {
        onPointerDown: startDrawing,
        onPointerMove: draw,
        onPointerUp: stopDrawing,
        onPointerCancel: stopDrawing
      }
    : {
        onMouseDown: startDrawing,
        onMouseMove: draw,
        onMouseUp: stopDrawing,
        onMouseLeave: stopDrawing,
        onTouchStart: startDrawing,
        onTouchMove: draw,
        onTouchEnd: stopDrawing,
        onTouchCancel: stopDrawing
      };

  return (
    <div className="firma-container">
      {label && <label className="firma-label">{label}</label>}

      <div className="firma-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="firma-canvas"
          {...canvasProps}
          aria-disabled={disabled}
        />

        <div className="firma-controls">
          <button
            type="button"
            className="btn-limpiar"
            onClick={() => clearCanvas(true)}
            disabled={disabled || (!hasDrawn && !value)}
          >
            LIMPIAR FIRMA
          </button>
          <span className="firma-instructions">FIRMA EN EL RECUADRO</span>
        </div>
      </div>
    </div>
  );
}

FirmaDigital.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string
};

FirmaDigital.defaultProps = {
  value: "",
  disabled: false,
  label: ""
};
