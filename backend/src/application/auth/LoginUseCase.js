export default class LoginUseCase {
  constructor(usuarioRepo, permisoRepo, hashUtil) {
    this.usuarioRepo = usuarioRepo;
    this.permisoRepo = permisoRepo;
    this.hashUtil = hashUtil;
  }

  async execute(email, password) {
    // Validacion de entrada
    if (!email || typeof email !== "string" || email.trim() === "") {
      throw new Error("Email es requerido");
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
      throw new Error("Contrasena es requerida");
    }

    const user = await this.usuarioRepo.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verificar contrasena usando el metodo correcto
    let isPasswordValid = false;
    if (typeof this.hashUtil.compareHash === "function") {
      isPasswordValid = await this.hashUtil.compareHash(password, user.password);
    } else if (typeof this.hashUtil.compare === "function") {
      isPasswordValid = await this.hashUtil.compare(password, user.password);
    }

    if (!isPasswordValid) {
      throw new Error("Contrasena incorrecta");
    }

    if (
      this.usuarioRepo &&
      typeof this.usuarioRepo.updatePassword === "function" &&
      typeof this.hashUtil.needsRehash === "function" &&
      this.hashUtil.needsRehash(user.password)
    ) {
      try {
        const upgradedHash = await this.hashUtil.hash(password);
        await this.usuarioRepo.updatePassword(user.id, upgradedHash);
      } catch {
        // No bloquear el login si el rehash falla.
      }
    }

    // Obtener permisos por rol (base)
    let permisos = [];
    if (this.permisoRepo && typeof this.permisoRepo.getPermisosByRol === "function") {
      try {
        permisos = await this.permisoRepo.getPermisosByRol(user.rol_id);
      } catch {
        permisos = [];
      }
    }

    // Si existe una parametrizacion explicita por usuario, sobreescribe los del rol.
    // Solo si hay permisos personalizados definidos, caso contrario usa los del rol.
    if (this.permisoRepo && typeof this.permisoRepo.getPermisosByUsuario === "function") {
      try {
        const permisosPersonalizados = await this.permisoRepo.getPermisosByUsuario(user.id);
        // Solo reemplazar si hay permisos personalizados explicitos (no null ni array vacio)
        if (Array.isArray(permisosPersonalizados) && permisosPersonalizados.length > 0) {
          permisos = permisosPersonalizados;
        }
      } catch {
        // No bloquear login por fallo de permisos personalizados.
      }
    }

    if (Number(user.rol_id) === 1 && !permisos.includes("ADMIN_TOTAL")) {
      permisos = [...permisos, "ADMIN_TOTAL"];
    }

    let debeCambiarPassword = false;
    if (this.usuarioRepo && typeof this.usuarioRepo.getDebeCambiarPassword === "function") {
      try {
        debeCambiarPassword = await this.usuarioRepo.getDebeCambiarPassword(user.id);
      } catch {
        debeCambiarPassword = false;
      }
    }

    let entidadesAsignadas;
    if (this.usuarioRepo && typeof this.usuarioRepo.getEntidadesByUsuario === "function") {
      try {
        entidadesAsignadas = await this.usuarioRepo.getEntidadesByUsuario(user.id);
      } catch {
        entidadesAsignadas = [];
      }
    }

    const userPayload = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol_id,
      permisos
    };

    if (Array.isArray(entidadesAsignadas)) {
      userPayload.entidades_asignadas = entidadesAsignadas;
    }

    if (debeCambiarPassword) {
      userPayload.debe_cambiar_password = true;
    }

    return userPayload;
  }
}
