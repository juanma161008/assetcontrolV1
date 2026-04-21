export default class FirmaDigital {
  constructor({
    id,
    orden_id,
    firma_base64,
    firmado_por,
    fecha
  }) {
    this.id = id;
    this.orden_id = orden_id;
    this.firma_base64 = firma_base64;
    this.firmado_por = firmado_por;
    this.fecha = fecha;
  }

  toJSON() {
    return {
      id: this.id,
      orden_id: this.orden_id,
      firma_base64: this.firma_base64,
      firmado_por: this.firmado_por,
      fecha: this.fecha
    };
  }
}
