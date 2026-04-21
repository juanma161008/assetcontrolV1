export default class Rol {
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
