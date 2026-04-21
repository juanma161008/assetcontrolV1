import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import "../../styles/firma.css";

function getPointerPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();

  if (event.touches.length) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top
    };
  }

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

export default function FirmaDigital({ value, onChange, disabled, label }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(Boolean(value));
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  const clearCanvas = (emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);

    if (emit) {
      onChange("");
    }
  };

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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
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
  }, [value, setupCanvas]);

  const startDrawing = (event) => {
    if (disabled) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    const point = getPointerPosition(event, canvas);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    // Ensure a single click/tap also creates a visible stroke.
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  };

  const draw = (event) => {
    if (disabled || !drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const point = getPointerPosition(event, canvas);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    if (disabled || !drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.closePath();
    // Only emit the signature if there's actual drawing content
    if (hasDrawnRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div className="firma-container">
      {label && <label className="firma-label">{label}</label>}

      <div className="firma-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="firma-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          disabled={disabled}
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
          <span className="firma-instructions">
            FIRMA EN EL RECUADRO
          </span>
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


