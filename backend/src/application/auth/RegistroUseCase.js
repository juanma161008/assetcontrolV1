import { buildPasswordPolicyMessage, validatePassword } from "../../utils/passwordPolicy.js";

export default class RegistroUseCase {
  constructor(usuarioRepository, hashService) {
    this.usuarioRepository = usuarioRepository;
    this.hashService = hashService;
  }

  async execute(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Datos de registro inválidos");
    }

    const { nombre, email, password, confirm_password } = data;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
      throw new Error("Nombre debe tener al menos 2 caracteres");
    }

    if (!email || typeof email !== "string" || !this.isValidEmail(email.trim())) {
      throw new Error("Email inválido");
    }

    if (!password || typeof password !== "string") {
      throw new Error("Contraseña es requerida");
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(buildPasswordPolicyMessage());
    }

    if (confirm_password !== undefined && password !== confirm_password) {
      throw new Error("Las contraseñas no coinciden");
    }

    const exists = await this.usuarioRepository.findByEmail(email.trim().toLowerCase());
    if (exists) {
      throw new Error("El email ya está registrado");
    }

    const hashed = await this.hashService.hash(password);

    return await this.usuarioRepository.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      rol_id: 3
    });
  }

  // regex segura (sin ReDoS)
  isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
}
