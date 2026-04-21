export default class Log {
  constructor({
    id,
    usuario_id,
    accion,
    entidad,
    entidad_id,
    antes,
    despues,
    ip,
    creado_en
  }) {
    this.id = id;
    this.usuario_id = usuario_id;
    this.accion = accion;
    this.entidad = entidad;
    this.entidad_id = entidad_id;
    this.antes = antes;
    this.despues = despues;
    this.ip = ip;
    this.creado_en = creado_en;
  }

  toJSON() {
    return {
      id: this.id,
      usuario_id: this.usuario_id,
      accion: this.accion,
      entidad: this.entidad,
      entidad_id: this.entidad_id,
      antes: this.antes,
      despues: this.despues,
      ip: this.ip,
      creado_en: this.creado_en
    };
  }
}

