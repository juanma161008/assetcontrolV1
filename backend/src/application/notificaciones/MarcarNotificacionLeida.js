export default class MarcarNotificacionLeida {
  constructor(notificacionRepository) {
    this.notificacionRepository = notificacionRepository;
  }

  async execute(usuarioId, notificacionId) {
    return this.notificacionRepository.markAsRead(notificacionId, usuarioId);
  }
}
