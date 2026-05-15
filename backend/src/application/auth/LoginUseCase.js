export default class LoginUseCase {
  constructor(usuarioRepo, permisoRepo, hashUtil) {
    this.usuarioRepo = usuarioRepo;
    this.permisoRepo = permisoRepo;
    this.hashUtil = hashUtil;
  }

  async execute(email, password) {
    this.validarCredenciales(email, password);

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.obtenerUsuario(normalizedEmail);

    await this.validarPassword(password, user.password);

    await this.actualizarHashSiEsNecesario(password, user);

    const permisos = await this.obtenerPermisos(user);

    const debeCambiarPassword =
      await this.obtenerDebeCambiarPassword(user.id);

    const entidadesAsignadas =
      await this.obtenerEntidadesAsignadas(user.id);

    return this.construirPayloadUsuario({
      user,
      permisos,
      debeCambiarPassword,
      entidadesAsignadas
    });
  }

  validarCredenciales(email, password) {
    this.validarCampoTexto(email, "Email es requerido");
    this.validarCampoTexto(password, "Contrasena es requerida");
  }

  validarCampoTexto(valor, mensaje) {
    if (!valor || typeof valor !== "string" || valor.trim() === "") {
      throw new Error(mensaje);
    }
  }

  async obtenerUsuario(email) {
    const user = await this.usuarioRepo.findByEmail(email);

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    return user;
  }

  async validarPassword(password, hashedPassword) {
    const isPasswordValid = await this.compararPassword(
      password,
      hashedPassword
    );

    if (!isPasswordValid) {
      throw new Error("Contrasena incorrecta");
    }
  }

  async compararPassword(password, hashedPassword) {
    if (typeof this.hashUtil.compareHash === "function") {
      return this.hashUtil.compareHash(password, hashedPassword);
    }

    if (typeof this.hashUtil.compare === "function") {
      return this.hashUtil.compare(password, hashedPassword);
    }

    return false;
  }

  async actualizarHashSiEsNecesario(password, user) {
    const puedeActualizarPassword =
      typeof this.usuarioRepo?.updatePassword === "function";

    const puedeRehash =
      typeof this.hashUtil?.needsRehash === "function";

    if (
      !puedeActualizarPassword ||
      !puedeRehash ||
      !this.hashUtil.needsRehash(user.password)
    ) {
      return;
    }

    try {
      const upgradedHash = await this.hashUtil.hash(password);

      await this.usuarioRepo.updatePassword(user.id, upgradedHash);
    } catch {
      // No bloquear el login si el rehash falla.
    }
  }

  async obtenerPermisos(user) {
    let permisos = await this.obtenerPermisosPorRol(user.rol_id);

    const permisosPersonalizados =
      await this.obtenerPermisosPersonalizados(user.id);

    if (permisosPersonalizados.length > 0) {
      permisos = permisosPersonalizados;
    }

    return this.agregarPermisoAdmin(user.rol_id, permisos);
  }

  async obtenerPermisosPorRol(rolId) {
    if (
      typeof this.permisoRepo?.getPermisosByRol !== "function"
    ) {
      return [];
    }

    try {
      return await this.permisoRepo.getPermisosByRol(rolId);
    } catch {
      return [];
    }
  }

  async obtenerPermisosPersonalizados(userId) {
    if (
      typeof this.permisoRepo?.getPermisosByUsuario !== "function"
    ) {
      return [];
    }

    try {
      const permisos =
        await this.permisoRepo.getPermisosByUsuario(userId);

      return Array.isArray(permisos) ? permisos : [];
    } catch {
      return [];
    }
  }

  agregarPermisoAdmin(rolId, permisos) {
    if (
      Number(rolId) === 1 &&
      !permisos.includes("ADMIN_TOTAL")
    ) {
      return [...permisos, "ADMIN_TOTAL"];
    }

    return permisos;
  }

  async obtenerDebeCambiarPassword(userId) {
    if (
      typeof this.usuarioRepo?.getDebeCambiarPassword !== "function"
    ) {
      return false;
    }

    try {
      return await this.usuarioRepo.getDebeCambiarPassword(userId);
    } catch {
      return false;
    }
  }

  async obtenerEntidadesAsignadas(userId) {
    if (
      typeof this.usuarioRepo?.getEntidadesByUsuario !== "function"
    ) {
      return [];
    }

    try {
      return await this.usuarioRepo.getEntidadesByUsuario(userId);
    } catch {
      return [];
    }
  }

  construirPayloadUsuario({
    user,
    permisos,
    debeCambiarPassword,
    entidadesAsignadas
  }) {
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