export default class Permiso {
  constructor({ id, nombre }) {
    this.id = id;
    this.nombre = nombre;
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre
    };
  }
}
