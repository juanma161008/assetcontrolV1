export default class Entidad {
  constructor({ id, nombre, tipo, direccion, telefono }) {
    this.id = id;
    this.nombre = nombre;
    this.tipo = tipo;
    this.direccion = direccion;
    this.telefono = telefono;
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      tipo: this.tipo,
      direccion: this.direccion,
      telefono: this.telefono
    };
  }
}
