export default class MarcarTodasNotificacionesLeidas {
  constructor(notificacionRepository) {
    this.notificacionRepository = notificacionRepository;
  }

  async execute(usuarioId) {
    return this.notificacionRepository.markAllAsRead(usuarioId);
  }
}
