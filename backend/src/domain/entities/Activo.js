export default class Activo {
  constructor({
    id,
    sede,
    numeroReporte,
    nombre,
    serial,
    areaPrincipal,
    areaSecundaria,
    equipo,
    marca,
    modelo,
    procesador,
    ram,
    tipoDisco,
    hdd,
    os,
    estado,
    entidad_id
  }) {
    this.id = id;
    this.sede = sede;
    this.numeroReporte = numeroReporte;
    this.nombre = nombre;
    this.serial = serial;
    this.areaPrincipal = areaPrincipal;
    this.areaSecundaria = areaSecundaria;
    this.equipo = equipo;
    this.marca = marca;
    this.modelo = modelo;
    this.procesador = procesador;
    this.ram = ram;
    this.tipoDisco = tipoDisco;
    this.hdd = hdd;
    this.os = os;
    this.estado = estado;
    this.entidad_id = entidad_id;
  }

  estaDisponible() {
    return this.estado === "Disponible";
  }
}
