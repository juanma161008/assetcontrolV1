export default class Mantenimiento {
  constructor({
    id,
    fecha,
    tipo,
    descripcion,
    activo_id,
    tecnico_id,
    estado = "Pendiente"
  }) {
    this.id = id;
    this.fecha = fecha;
    this.tipo = tipo;
    this.descripcion = descripcion;
    this.activo_id = activo_id;
    this.tecnico_id = tecnico_id;
    this.estado = estado;
  }

  finalizar() {
    this.estado = "Finalizado";
  }
}
