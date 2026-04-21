import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/infrastructure/database/postgres.js", () => ({
  default: {
    query: vi.fn()
  }
}));

import pool from "../src/infrastructure/database/postgres.js";
import ActivoPgRepository from "../src/infrastructure/repositories/ActivoPgRepository.js";
import EntidadPgRepository from "../src/infrastructure/repositories/EntidadPgRepository.js";
import LogPgRepository from "../src/infrastructure/repositories/LogPgRepository.js";
import MantenimientoPgRepository from "../src/infrastructure/repositories/MantenimientoPgRepository.js";
import OrdenPgRepository from "../src/infrastructure/repositories/OrdenPgRepository.js";
import PermisoPgRepository from "../src/infrastructure/repositories/PermisoPgRepository.js";
import UsuarioPgRepository from "../src/infrastructure/repositories/UsuarioPgRepository.js";

describe("Postgres repositories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ActivoPgRepository findAll, findById, create, update y delete", async () => {
    const repo = new ActivoPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    const all = await repo.findAll();
    expect(all).toEqual([{ id: 2 }]);
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      "SELECT * FROM activos ORDER BY id DESC"
    );

    pool.query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
    const found = await repo.findById(9);
    expect(found).toEqual({ id: 9 });
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM activos WHERE id=$1",
      [9]
    );

    const createData = {
      sede: "A",
      numeroReporte: "R1",
      nombre: "Activo",
      serial: "S1",
      areaPrincipal: "TI",
      areaSecundaria: "Soporte",
      equipo: "Laptop",
      marca: "Dell",
      modelo: "M1",
      procesador: "i7",
      ram: "16GB",
      tipoDisco: "SSD",
      hdd: "0",
      os: "Linux",
      estado: "Disponible",
      entidad_id: 1
    };
    pool.query.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    const created = await repo.create(createData);
    expect(created).toEqual({ id: 11 });
    expect(pool.query).toHaveBeenCalledTimes(3);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 11, estado: "OK" }] });
    const updated = await repo.update(11, createData);
    expect(updated).toEqual({ id: 11, estado: "OK" });
    expect(pool.query).toHaveBeenCalledTimes(4);

    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.delete(11);
    expect(pool.query).toHaveBeenNthCalledWith(
      5,
      "DELETE FROM activos WHERE id=$1",
      [11]
    );
  });

  it("EntidadPgRepository findAll y create", async () => {
    const repo = new EntidadPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const all = await repo.findAll();
    expect(all).toEqual([{ id: 1 }]);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, nombre: "Cliente X" }] });
    const created = await repo.create({
      nombre: "Cliente X",
      tipo: "Cliente",
      direccion: "Calle 1",
      telefono: "123",
      email: "x@x.com"
    });
    expect(created).toEqual({ id: 2, nombre: "Cliente X" });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("LogPgRepository create y findAll", async () => {
    const repo = new LogPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.create({
      usuario_id: 1,
      accion: "CREAR",
      entidad: "ACTIVO",
      entidad_id: 5,
      antes: null,
      despues: { ok: true },
      ip: "127.0.0.1"
    });
    expect(pool.query).toHaveBeenCalledTimes(1);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 8 }] });
    const logs = await repo.findAll();
    expect(logs).toEqual([{ id: 8 }]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("MantenimientoPgRepository findAll, create, update y delete", async () => {
    const repo = new MantenimientoPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const all = await repo.findAll();
    expect(all).toEqual([{ id: 1 }]);

    const data = {
      fecha: "2026-01-01",
      tipo: "Preventivo",
      descripcion: "OK",
      activo_id: 2,
      tecnico_id: 4,
      estado: "Pendiente"
    };

    pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
    const created = await repo.create(data);
    expect(created).toEqual({ id: 3 });

    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, estado: "Finalizado" }] });
    const updated = await repo.update(3, {
      ...data,
      estado: "Finalizado",
      numeroReporte: "RPT-001"
    });
    expect(updated).toEqual({ id: 3, estado: "Finalizado" });
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("numero_reporte=CASE WHEN $9 THEN $7 ELSE numero_reporte END"),
      ["2026-01-01", "Preventivo", "OK", 2, 4, "Finalizado", "RPT-001", true, true, 3]
    );

    pool.query.mockResolvedValueOnce({ rows: [{ id: 3, tecnico_id: null }] });
    const updatedWithNullTecnico = await repo.update(3, { tecnico_id: null, numeroReporte: null });
    expect(updatedWithNullTecnico).toEqual({ id: 3, tecnico_id: null });
    expect(pool.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("numero_reporte=CASE WHEN $9 THEN $7 ELSE numero_reporte END"),
      [null, null, null, null, null, null, null, true, true, 3]
    );

    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.delete(3);
    expect(pool.query).toHaveBeenNthCalledWith(
      5,
      "DELETE FROM mantenimientos WHERE id=$1",
      [3]
    );
  });

  it("OrdenPgRepository create, firmar y findById", async () => {
    const repo = new OrdenPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 10, numero: "OT-10" }] });
    const created = await repo.create({
      numero: "OT-10",
      fecha: "2026-01-01",
      estado: "Pendiente",
      creado_por: 1
    });
    expect(created).toEqual({ id: 10, numero: "OT-10" });

    pool.query.mockResolvedValueOnce({ rows: [] });
    pool.query.mockResolvedValueOnce({ rows: [] });
    await repo.firmar(10, "base64", 1);
    expect(pool.query).toHaveBeenCalledTimes(3);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 10, estado: "Firmada" }] });
    const found = await repo.findById(10);
    expect(found).toEqual({ id: 10, estado: "Firmada" });
  });

  it("PermisoPgRepository mapea permisos por rol", async () => {
    const repo = new PermisoPgRepository();

    pool.query.mockResolvedValueOnce({
      rows: [{ nombre: "VER_ACTIVOS" }, { nombre: "CREAR_ACTIVO" }]
    });

    const permisos = await repo.getPermisosByRol(2);
    expect(permisos).toEqual(["VER_ACTIVOS", "CREAR_ACTIVO"]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT p.nombre"), [2]);
  });

  it("UsuarioPgRepository findByEmail, create y findById", async () => {
    const repo = new UsuarioPgRepository();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, email: "u@x.com" }] });
    const byEmail = await repo.findByEmail("u@x.com");
    expect(byEmail).toEqual({ id: 1, email: "u@x.com" });

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, email: "n@x.com" }] });
    const created = await repo.create({
      nombre: "Nuevo",
      email: "n@x.com",
      password: "hash",
      rol_id: 3
    });
    expect(created).toEqual({ id: 2, email: "n@x.com" });

    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, nombre: "Nuevo" }] });
    const byId = await repo.findById(2);
    expect(byId).toEqual({ id: 2, nombre: "Nuevo" });
  });
});
