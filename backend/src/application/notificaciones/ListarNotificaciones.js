export default class ListarNotificaciones {
  constructor(notificacionRepository) {
    this.notificacionRepository = notificacionRepository;
  }

  async execute(usuarioId, options = {}) {
    return this.notificacionRepository.findByUsuario(usuarioId, options);
  }
}
