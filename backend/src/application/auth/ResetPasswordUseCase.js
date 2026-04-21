import { buildPasswordPolicyMessage, validatePassword } from "../../utils/passwordPolicy.js";

export default class ResetPasswordUseCase {
  constructor(usuarioRepository, hashService) {
    this.usuarioRepository = usuarioRepository;
    this.hashService = hashService;
  }

  async execute(adminUserId, targetUserId, newPassword, debeCambiarPassword = true) {
    // Verificar que el admin tenga permisos (esto se hace en el controller con middleware)

    // Verificar que el usuario objetivo existe
    const targetUser = await this.usuarioRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Usuario no encontrado");
    }

    // No permitir resetear la contraseña de otro admin (opcional)
    if (targetUser.rol_id === 1 && adminUserId !== targetUserId) {
      throw new Error("No puedes resetear la contraseña de otro administrador");
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(buildPasswordPolicyMessage());
    }

    // Hash de la nueva contraseña
    const hashedPassword = await this.hashService.hash(newPassword);

    // Actualizar la contraseña
    await this.usuarioRepository.updatePassword(targetUserId, hashedPassword);
    if (typeof this.usuarioRepository.setDebeCambiarPassword === "function") {
      await this.usuarioRepository.setDebeCambiarPassword(
        targetUserId,
        Boolean(debeCambiarPassword)
      );
    }

    return { message: "Contraseña reseteada exitosamente" };
  }
}
