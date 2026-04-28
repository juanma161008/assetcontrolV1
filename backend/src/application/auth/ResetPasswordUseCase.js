import { buildPasswordPolicyMessage, validatePassword } from "../../utils/passwordPolicy.js";
import {
  assertPasswordNotReused,
  loadRecentPasswordHashes
} from "../../utils/passwordSecurity.js";

export default class ResetPasswordUseCase {
  constructor(usuarioRepository, hashService) {
    this.usuarioRepository = usuarioRepository;
    this.hashService = hashService;
  }

  async execute(adminUserId, targetUserId, newPassword, debeCambiarPassword = true) {
    // Verificar que el usuario objetivo existe
    const targetUser = await this.usuarioRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error("Usuario no encontrado");
    }

    // No permitir resetear la contrasena de otro admin (opcional)
    if (Number(targetUser.rol_id) === 1 && Number(adminUserId) !== Number(targetUserId)) {
      throw new Error("No puedes resetear la contrasena de otro administrador");
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(buildPasswordPolicyMessage());
    }

    const previousPasswordHashes = await loadRecentPasswordHashes(
      this.usuarioRepository,
      targetUser.id
    );

    await assertPasswordNotReused({
      candidatePassword: newPassword,
      currentPasswordHash: targetUser.password,
      previousPasswordHashes,
      hashService: this.hashService
    });

    const hashedPassword = await this.hashService.hash(newPassword);

    // Actualizar la contrasena
    await this.usuarioRepository.updatePassword(targetUserId, hashedPassword);
    if (typeof this.usuarioRepository.setDebeCambiarPassword === "function") {
      await this.usuarioRepository.setDebeCambiarPassword(
        targetUserId,
        Boolean(debeCambiarPassword)
      );
    }

    return { message: "Contrasena reseteada exitosamente" };
  }
}
