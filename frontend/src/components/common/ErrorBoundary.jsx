import React from "react";
import PropTypes from "prop-types";
import httpClient from "../../services/httpClient";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: "" };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = globalThis.crypto?.randomUUID?.() || String(Date.now());
    this.setState({ errorId });

    const payload = {
      mensaje: error?.message || "Error inesperado en la interfaz",
      detalle: {
        stack: error?.stack || null,
        componentStack: errorInfo?.componentStack || null
      },
      origen: "frontend-ui",
      contexto: {
        url: globalThis.location?.href || null,
        userAgent: globalThis.navigator?.userAgent || null,
        errorId
      }
    };

    httpClient
      .post("/api/auditoria/errores", payload, { skipErrorLog: true, skipAuthRedirect: true })
      .catch(() => {});
  }

  handleReload = () => {
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container" style={{ maxWidth: "760px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "8px" }}>Algo salió mal</h2>
          <p style={{ color: "#334155", marginBottom: "16px" }}>
            Ocurrió un error inesperado en la interfaz. Puedes recargar la página o intentar más tarde.
          </p>
          {this.state.errorId && (
            <p style={{ color: "#64748b", marginBottom: "12px" }}>
              Código de error: {this.state.errorId}
            </p>
          )}
          <button type="button" className="btn-action" onClick={this.handleReload}>
            Recargar aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node
};

ErrorBoundary.defaultProps = {
  children: null
};

export default ErrorBoundary;
