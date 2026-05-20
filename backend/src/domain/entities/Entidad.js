export default class Entidad {
  constructor({ id, nombre, nit, tipo, direccion, telefono }) {
    this.id = id;
    this.nombre = nombre;
    this.nit = nit;
    this.tipo = tipo;
    this.direccion = direccion;
    this.telefono = telefono;
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      nit: this.nit,
      tipo: this.tipo,
      direccion: this.direccion,
      telefono: this.telefono
    };
  }
}

