export default class CrearNotificacion {
  constructor(notificacionRepository) {
    this.notificacionRepository = notificacionRepository;
  }

  async execute(data = {}) {
    if (!data?.usuario_id) {
      throw new Error("usuario_id requerido");
    }
    if (!data?.titulo) {
      throw new Error("titulo requerido");
    }
    return this.notificacionRepository.create(data);
  }
}
