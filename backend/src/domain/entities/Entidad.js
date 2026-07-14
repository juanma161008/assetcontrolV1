export default class Entidad {
  constructor({ id, nombre, nit, tipo, direccion, telefono, tipos_equipos_permitidos = [] }) {
    this.id = id;
    this.nombre = nombre;
    this.nit = nit;
    this.tipo = tipo;
    this.direccion = direccion;
    this.telefono = telefono;
    this.tipos_equipos_permitidos = Array.isArray(tipos_equipos_permitidos) ? tipos_equipos_permitidos : [];
  }

  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      nit: this.nit,
      tipo: this.tipo,
      direccion: this.direccion,
      telefono: this.telefono,
      tipos_equipos_permitidos: this.tipos_equipos_permitidos
    };
  }
}

