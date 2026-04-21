import logoAsset from "../../assets/logos/logo-assetcontrol.png";
import logoM5 from "../../assets/logos/logom5.png";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import {
  login as authLogin,
  register as authRegister,
  requestUsernameRecovery,
  verifyUsernameRecovery
} from "../../services/authService";
import {
  PASSWORD_POLICY,
  buildPasswordPolicyMessage,
  validatePassword
} from "../../utils/passwordPolicy";

function getPasswordStrength(password = "") {
  const safePassword = String(password || "");
  let score = 0;

  if (safePassword.length >= PASSWORD_POLICY.minLength) score += 1;
  if (/[A-Z]/.test(safePassword)) score += 1;
  if (/[a-z]/.test(safePassword)) score += 1;
  if (/\d/.test(safePassword)) score += 1;
  if (/[^A-Za-z0-9]/.test(safePassword)) score += 1;

  if (!safePassword) {
    return { label: "Sin definir", className: "level-empty", percent: 0 };
  }
  if (score <= 2) {
    return { label: "Débil", className: "level-weak", percent: 30 };
  }
  if (score <= 4) {
    return { label: "Media", className: "level-medium", percent: 65 };
  }

  return { label: "Fuerte", className: "level-strong", percent: 100 };
}

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();

  const [showRegister, setShowRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotUser, setShowForgotUser] = useState(false);
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotForm, setForgotForm] = useState({ email: "", code: "" });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [recoveredUser, setRecoveredUser] = useState(null);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [showRegisterKey, setShowRegisterKey] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirm_password: "",
    clave_registro: ""
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  const passwordStrength = useMemo(() => getPasswordStrength(registerForm.password), [registerForm.password]);

  const handleSwitchMode = (registerMode) => {
    if (isLoading) return;
    setShowRegister(registerMode);
    if (registerMode) {
      setShowForgotUser(false);
    }
  };

  const resetForgotState = (nextEmail = "") => {
    setForgotError("");
    setForgotMessage("");
    setRecoveredUser(null);
    setForgotStep("request");
    setForgotForm({ email: nextEmail, code: "" });
  };

  const toggleForgotUser = () => {
    if (isLoading || forgotLoading) return;
    if (showForgotUser) {
      setShowForgotUser(false);
      return;
    }
    resetForgotState(loginForm.email);
    setShowForgotUser(true);
  };

  const handleForgotRequest = async (event) => {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!forgotForm.email) {
      setForgotError("Debes ingresar tu correo.");
      return;
    }

    setForgotLoading(true);

    try {
      const result = await requestUsernameRecovery(forgotForm.email);
      if (result.success) {
        const emailServiceAvailable = result.data?.data?.emailServiceAvailable !== false;
        if (!emailServiceAvailable) {
          setForgotError(result.message || "No se pudo enviar el correo.");
          return;
        }
        setForgotMessage(result.message || "Si el correo esta registrado, enviaremos un codigo.");
        setForgotStep("verify");
      } else {
        setForgotError(result.error || "No fue posible enviar el codigo.");
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Error de conexión.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerify = async (event) => {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!forgotForm.email || !forgotForm.code) {
      setForgotError("Correo y codigo son requeridos.");
      return;
    }

    setForgotLoading(true);

    try {
      const result = await verifyUsernameRecovery(forgotForm.email, forgotForm.code);
      if (result.success) {
        const payload = result.data?.data || {};
        setRecoveredUser({
          email: payload.email || forgotForm.email,
          nombre: payload.nombre || ""
        });
        setForgotMessage(result.message || "Usuario verificado.");
        setForgotStep("done");
      } else {
        setForgotError(result.error || "No se pudo verificar el codigo.");
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Error de conexión.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUseRecoveredUser = () => {
    if (!recoveredUser?.email) return;
    setLoginForm((previous) => ({
      ...previous,
      email: recoveredUser.email
    }));
    setShowForgotUser(false);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!loginForm.email || !loginForm.password) {
      setError("Email y contraseña son requeridos.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await authLogin(loginForm.email, loginForm.password);

      if (result.success) {
        setSuccess("Acceso correcto.");
        onLoginSuccess({ user: result.user, token: result.token });
        navigate("/");
      } else {
        setError(result.error || "No fue posible iniciar sesión.");
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Error de conexión.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      !registerForm.nombre ||
      !registerForm.email ||
      !registerForm.password ||
      !registerForm.confirm_password ||
      !registerForm.clave_registro
    ) {
      setError("Todos los campos son requeridos.");
      return;
    }

    if (registerForm.password !== registerForm.confirm_password) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const passwordValidation = validatePassword(registerForm.password);
    if (!passwordValidation.valid) {
      setError(buildPasswordPolicyMessage());
      return;
    }

    setIsLoading(true);

    try {
      const result = await authRegister({
        nombre: registerForm.nombre,
        email: registerForm.email,
        password: registerForm.password,
        confirm_password: registerForm.confirm_password,
        clave_registro: registerForm.clave_registro
      });

      if (result.success) {
        setSuccess(result?.data?.message || "Usuario registrado exitosamente.");

        const registeredEmail = registerForm.email;
        setRegisterForm({
          nombre: "",
          email: "",
          password: "",
          confirm_password: "",
          clave_registro: ""
        });

        setLoginForm((previous) => ({
          ...previous,
          email: registeredEmail
        }));

        setTimeout(() => {
          setShowRegister(false);
          setSuccess("");
        }, 1800);
      } else {
        setError(result.error || "No fue posible registrar el usuario.");
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || "Error de conexión con el servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setError("");
    setSuccess("");
    setForgotError("");
    setForgotMessage("");
    if (showRegister) {
      setShowForgotUser(false);
    }
  }, [showRegister]);

  return (
    <div className="page page-login">
      <div className="auth-layout auth-layout-single">
        <div className="panel auth-card auth-card-elevated">
          <div className="auth-brand auth-brand-login">
            <div className="auth-brand-logos">
              <img src={logoAsset} alt="AssetControl" className="auth-logo-primary" />
              <img src={logoM5} alt="M5" className="auth-logo-secondary" />
            </div>
          </div>

          <div className="auth-switch" role="tablist" aria-label="Selección de formulario">
            <button
              type="button"
              className={`auth-switch-btn ${!showRegister ? "active" : ""}`}
              onClick={() => handleSwitchMode(false)}
              disabled={isLoading}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={`auth-switch-btn ${showRegister ? "active" : ""}`}
              onClick={() => handleSwitchMode(true)}
              disabled={isLoading}
            >
              Registro
            </button>
          </div>

          <h1 className="auth-title">{showRegister ? "Registro de usuario" : "Bienvenido"}</h1>
          <p className="auth-subtitle auth-subtitle-centered">
            {showRegister
              ? "Crea tu cuenta para acceder al sistema institucional."
              : "Ingresa con tus credenciales para continuar en AssetControl."}
          </p>

          {error && <p className="error-message error-inline auth-message-card">{error}</p>}
          {success && <p className="success-message error-inline auth-message-card">{success}</p>}

          {showRegister ? (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="field-group">
                <label htmlFor="register-nombre">Nombre completo</label>
                <input
                  id="register-nombre"
                  className="input-field"
                  type="text"
                  placeholder="Nombre completo"
                  value={registerForm.nombre}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, nombre: event.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label htmlFor="register-email">Email corporativo</label>
                <input
                  id="register-email"
                  className="input-field"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="field-group">
                <label htmlFor="register-password">Contraseña</label>
                <div className="input-with-action">
                  <input
                    id="register-password"
                    className="input-field"
                    type={showRegisterPassword ? "text" : "password"}
                    placeholder={`Mínimo ${PASSWORD_POLICY.minLength} caracteres`}
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, password: event.target.value })
                    }
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="input-action-btn"
                    onClick={() => setShowRegisterPassword((previous) => !previous)}
                    disabled={isLoading}
                  >
                    {showRegisterPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>

                <div className="password-meter">
                  <div className="password-meter-track">
                    <span
                      className={`password-meter-fill ${passwordStrength.className}`}
                      style={{ width: `${passwordStrength.percent}%` }}
                    ></span>
                  </div>
                  <small className={`password-meter-label ${passwordStrength.className}`}>
                    Fortaleza: {passwordStrength.label}
                  </small>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="register-confirm-password">Confirmar contraseña</label>
                <div className="input-with-action">
                  <input
                    id="register-confirm-password"
                    className="input-field"
                    type={showRegisterConfirm ? "text" : "password"}
                    placeholder="Confirma tu contraseña"
                    value={registerForm.confirm_password}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, confirm_password: event.target.value })
                    }
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="input-action-btn"
                    onClick={() => setShowRegisterConfirm((previous) => !previous)}
                    disabled={isLoading}
                  >
                    {showRegisterConfirm ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="register-clave">Clave de registro</label>
                <div className="input-with-action">
                  <input
                    id="register-clave"
                    className="input-field"
                    type={showRegisterKey ? "text" : "password"}
                    placeholder="Clave de registro"
                    value={registerForm.clave_registro}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, clave_registro: event.target.value })
                    }
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="input-action-btn"
                    onClick={() => setShowRegisterKey((previous) => !previous)}
                    disabled={isLoading}
                  >
                    {showRegisterKey ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? "Registrando..." : "Crear cuenta"}
              </button>

              <p className="login-hint">
                Ya tienes cuenta{" "}
                <button
                  type="button"
                  className="ghost-button auth-inline-link"
                  onClick={() => handleSwitchMode(false)}
                  disabled={isLoading}
                >
                  Inicia sesión
                </button>
              </p>
            </form>
          ) : (
            <>
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="field-group">
                  <label htmlFor="login-email">Email corporativo</label>
                  <input
                    id="login-email"
                    className="input-field"
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="login-password">Contraseña</label>
                  <div className="input-with-action">
                    <input
                      id="login-password"
                      className="input-field"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Contraseña"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="input-action-btn"
                      onClick={() => setShowLoginPassword((previous) => !previous)}
                      disabled={isLoading}
                    >
                      {showLoginPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>

                <p className="auth-form-note">Canal seguro activo. Acceso controlado por permisos.</p>

                <button type="submit" className="primary-button" disabled={isLoading}>
                  {isLoading ? "Validando..." : "Ingresar"}
                </button>
              </form>

              <div className="auth-helper">
                <button
                  type="button"
                  className="ghost-button auth-inline-link auth-helper-toggle"
                  onClick={toggleForgotUser}
                  disabled={isLoading || forgotLoading}
                >
                  {showForgotUser ? "Cerrar recuperación" : "Olvidé mi usuario"}
                </button>

                {showForgotUser && (
                  <div className="auth-helper-panel">
                    <div>
                      <h3 className="auth-helper-title">Recuperar usuario</h3>
                      <p className="auth-helper-note">
                        Te enviaremos un código de verificación al correo registrado.
                      </p>
                    </div>

                    {forgotError && (
                      <p className="error-message error-inline auth-message-card">{forgotError}</p>
                    )}
                    {forgotMessage && (
                      <p className="success-message error-inline auth-message-card">{forgotMessage}</p>
                    )}

                    {forgotStep === "request" && (
                      <form className="auth-helper-form" onSubmit={handleForgotRequest}>
                        <div className="field-group">
                          <label htmlFor="forgot-email">Email corporativo</label>
                          <input
                            id="forgot-email"
                            className="input-field"
                            type="email"
                            placeholder="usuario@empresa.com"
                            value={forgotForm.email}
                            onChange={(event) =>
                              setForgotForm({ ...forgotForm, email: event.target.value })
                            }
                            required
                            disabled={forgotLoading}
                          />
                        </div>

                        <div className="auth-helper-actions">
                          <button type="submit" className="primary-button" disabled={forgotLoading}>
                            {forgotLoading ? "Enviando..." : "Enviar código"}
                          </button>
                        </div>
                      </form>
                    )}

                    {forgotStep === "verify" && (
                      <form className="auth-helper-form" onSubmit={handleForgotVerify}>
                        <div className="field-group">
                          <label htmlFor="forgot-email-verify">Email corporativo</label>
                          <input
                            id="forgot-email-verify"
                            className="input-field"
                            type="email"
                            placeholder="usuario@empresa.com"
                            value={forgotForm.email}
                            onChange={(event) =>
                              setForgotForm({ ...forgotForm, email: event.target.value })
                            }
                            required
                            disabled={forgotLoading}
                          />
                        </div>

                        <div className="field-group">
                          <label htmlFor="forgot-code">Código de verificación</label>
                          <input
                            id="forgot-code"
                            className="input-field"
                            type="text"
                            placeholder="Código de 6 dígitos"
                            value={forgotForm.code}
                            onChange={(event) =>
                              setForgotForm({ ...forgotForm, code: event.target.value })
                            }
                            required
                            disabled={forgotLoading}
                          />
                        </div>

                        <div className="auth-helper-actions">
                          <button type="submit" className="primary-button" disabled={forgotLoading}>
                            {forgotLoading ? "Verificando..." : "Verificar"}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={handleForgotRequest}
                            disabled={forgotLoading}
                          >
                            Reenviar código
                          </button>
                        </div>
                      </form>
                    )}

                    {forgotStep === "done" && (
                      <div className="auth-helper-result">
                        <p className="auth-helper-note">Tu usuario registrado es:</p>
                        <div className="auth-helper-user">
                          {recoveredUser?.email || forgotForm.email || "-"}
                        </div>
                        {recoveredUser?.nombre && (
                          <p className="auth-helper-note">
                            Nombre: {recoveredUser.nombre}
                          </p>
                        )}
                        <div className="auth-helper-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={handleUseRecoveredUser}
                          >
                            Usar este usuario
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setShowForgotUser(false)}
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Login.propTypes = {
  onLoginSuccess: PropTypes.func.isRequired
};
