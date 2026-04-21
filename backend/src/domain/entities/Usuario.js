export default class Usuario {
  constructor({ id, nombre, email, password, rol_id, activo = true }) {
    this.id = id;
    this.nombre = nombre;
    this.email = email;
    this.password = password;
    this.rol_id = rol_id;
    this.activo = activo;
  }

  esActivo() {
    return this.activo === true;
  }
}
