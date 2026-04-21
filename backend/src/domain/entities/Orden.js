export default class Orden {
  constructor({
    id,
    numero,
    fecha,
    estado = "Pendiente",
    creado_por
  }) {
    this.id = id;
    this.numero = numero;
    this.fecha = fecha;
    this.estado = estado;
    this.creado_por = creado_por;
  }

  firmar() {
    this.estado = "Firmada";
  }
}
