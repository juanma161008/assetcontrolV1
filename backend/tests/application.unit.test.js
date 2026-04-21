import { describe, it, expect, vi } from "vitest";

import CrearActivo from "../src/application/activos/CrearActivo.js";
import EditarActivo from "../src/application/activos/EditarActivo.js";
import EliminarActivo from "../src/application/activos/EliminarActivo.js";
import ListarActivos from "../src/application/activos/ListarActivos.js";

import CrearMantenimiento from "../src/application/mantenimientos/CrearMantenimiento.js";
import EditarMantenimiento from "../src/application/mantenimientos/EditarMantenimiento.js";
import EliminarMantenimiento from "../src/application/mantenimientos/EliminarMantenimiento.js";
import ListarMantenimientos from "../src/application/mantenimientos/ListarMantenimientos.js";

import LoginUseCase from "../src/application/auth/LoginUseCase.js";
import RegistroUseCase from "../src/application/auth/RegistroUseCase.js";
import ResetPasswordUseCase from "../src/application/auth/ResetPasswordUseCase.js";

import RegistrarLog from "../src/application/auditoria/RegistrarLog.js";

import CrearEntidad from "../src/application/entidades/CrearEntidad.js";
import EditarEntidad from "../src/application/entidades/EditarEntidad.js";
import EliminarEntidad from "../src/application/entidades/EliminarEntidad.js";
import ListarEntidades from "../src/application/entidades/ListarEntidades.js";
import ObtenerEntidad from "../src/application/entidades/ObtenerEntidad.js";

import EnviarCorreo from "../src/application/notificaciones/EnviarCorreo.js";
import CrearOrden from "../src/application/ordenes/CrearOrden.js";
import EliminarOrden from "../src/application/ordenes/EliminarOrden.js";
import FirmarOrden from "../src/application/ordenes/FirmarOrden.js";
import GenerarPDF from "../src/application/ordenes/GenerarPDF.js";
import ListarOrden from "../src/application/ordenes/ListarOrden.js";
import ObtenerOrden from "../src/application/ordenes/ObtenerOrden.js";

describe("Application use cases", () => {
  it("CrearActivo valida datos obligatorios", async () => {
    const useCase = new CrearActivo({ create: vi.fn() }, { execute: vi.fn() });
    await expect(useCase.execute({ nombre: "" }, 1)).rejects.toThrow(
      "Datos obligatorios faltantes"
    );
  });

  it("CrearActivo crea y registra log", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: 7, nombre: "A" }) };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearActivo(repo, log);

    const data = { nombre: "Activo 1", equipo: "Laptop" };
    const result = await useCase.execute(data, 12);

    expect(repo.create).toHaveBeenCalledWith(data);
    expect(log.execute).toHaveBeenCalledWith(12, "CREAR_ACTIVO", 7);
    expect(result).toEqual({ id: 7, nombre: "A" });
  });

  it("EditarActivo actualiza y registra log", async () => {
    const repo = { update: vi.fn().mockResolvedValue({ id: 4, estado: "OK" }) };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EditarActivo(repo, log);

    const result = await useCase.execute(4, { estado: "OK" }, 9);

    expect(repo.update).toHaveBeenCalledWith(4, { estado: "OK" });
    expect(log.execute).toHaveBeenCalledWith(9, "EDITAR_ACTIVO", 4);
    expect(result).toEqual({ id: 4, estado: "OK" });
  });

  it("EliminarActivo elimina y registra log", async () => {
    const repo = { delete: vi.fn().mockResolvedValue(undefined) };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EliminarActivo(repo, log);

    const result = await useCase.execute(5, 11);

    expect(repo.delete).toHaveBeenCalledWith(5);
    expect(log.execute).toHaveBeenCalledWith(11, "ELIMINAR_ACTIVO", 5);
    expect(result).toBe(true);
  });

  it("ListarActivos delega al repositorio", async () => {
    const repo = { findAll: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) };
    const useCase = new ListarActivos(repo);

    const result = await useCase.execute();

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("CrearMantenimiento falla si activo no existe", async () => {
    const useCase = new CrearMantenimiento(
      { create: vi.fn() },
      { findById: vi.fn().mockResolvedValue(null) },
      { execute: vi.fn() }
    );

    await expect(useCase.execute({ activo_id: 99 }, 1)).rejects.toThrow(
      "Activo no existe"
    );
  });

  it("CrearMantenimiento valida activo_id y normaliza tecnico_id", async () => {
    const mantRepo = { create: vi.fn().mockResolvedValue({ id: 22 }) };
    const activoRepo = { findById: vi.fn().mockResolvedValue({ id: 2 }) };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearMantenimiento(mantRepo, activoRepo, log);

    await expect(useCase.execute({ activo_id: "abc" }, 9)).rejects.toThrow("Activo no existe");

    await useCase.execute({ activo_id: 2, tecnico_id: "11" }, 9);
    expect(mantRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ activo_id: 2, tecnico_id: 11 })
    );

    await useCase.execute({ activo_id: 2, tecnico_id: "" }, 9);
    expect(mantRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ activo_id: 2, tecnico_id: "" })
    );
  });

  it("CrearMantenimiento permite punto de red sin activo asociado", async () => {
    const mantRepo = { create: vi.fn().mockResolvedValue({ id: 23, tipo: "Preventivo Punto De Red" }) };
    const activoRepo = { findById: vi.fn() };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearMantenimiento(mantRepo, activoRepo, log);

    await useCase.execute({ tipo: "Instalacion Punto De Red", numeroReporte: "PR-001" }, 7);

    expect(activoRepo.findById).not.toHaveBeenCalled();
    expect(mantRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        activo_id: null,
        tipo: "Preventivo Punto De Red",
        numeroReporte: "PR-001"
      })
    );
    expect(log.execute).toHaveBeenCalledWith(7, "CREAR_MANTENIMIENTO", 23);
  });

  it("CrearMantenimiento crea y registra log", async () => {
    const mantRepo = { create: vi.fn().mockResolvedValue({ id: 15, tipo: "P" }) };
    const activoRepo = { findById: vi.fn().mockResolvedValue({ id: 2 }) };
    const log = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearMantenimiento(mantRepo, activoRepo, log);

    const data = { activo_id: 2, tipo: "Preventivo" };
    const result = await useCase.execute(data, 8);

    expect(activoRepo.findById).toHaveBeenCalledWith(2);
    expect(mantRepo.create).toHaveBeenCalledWith(data);
    expect(log.execute).toHaveBeenCalledWith(8, "CREAR_MANTENIMIENTO", 15);
    expect(result).toEqual({ id: 15, tipo: "P" });
  });

  it("EditarMantenimiento delega update", async () => {
    const repo = { update: vi.fn().mockResolvedValue({ id: 1, estado: "OK" }) };
    const useCase = new EditarMantenimiento(repo);

    const result = await useCase.execute(1, { estado: "OK" });

    expect(repo.update).toHaveBeenCalledWith(1, { estado: "OK" });
    expect(result).toEqual({ id: 1, estado: "OK" });
  });

  it("EditarMantenimiento registra log cuando hay usuario", async () => {
    const repo = { update: vi.fn().mockResolvedValue({ id: 7, estado: "Finalizado" }) };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EditarMantenimiento(repo, logUseCase);

    await useCase.execute(7, { estado: "Finalizado" }, 50);
    expect(logUseCase.execute).toHaveBeenCalledWith(50, "EDITAR_MANTENIMIENTO", 7);
  });

  it("EliminarMantenimiento delega delete", async () => {
    const repo = { delete: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EliminarMantenimiento(repo);

    const result = await useCase.execute(3);

    expect(repo.delete).toHaveBeenCalledWith(3);
    expect(result).toBe(true);
  });

  it("EliminarMantenimiento registra log cuando hay usuario", async () => {
    const repo = { delete: vi.fn().mockResolvedValue(undefined) };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EliminarMantenimiento(repo, logUseCase);

    await useCase.execute(3, 99);
    expect(logUseCase.execute).toHaveBeenCalledWith(99, "ELIMINAR_MANTENIMIENTO", 3);
  });

  it("ListarMantenimientos delega findAll", async () => {
    const repo = { findAll: vi.fn().mockResolvedValue([{ id: 1 }]) };
    const useCase = new ListarMantenimientos(repo);

    const result = await useCase.execute();

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("LoginUseCase falla cuando no existe usuario", async () => {
    const useCase = new LoginUseCase(
      { findByEmail: vi.fn().mockResolvedValue(null) },
      null,
      { compare: vi.fn() }
    );

    await expect(useCase.execute("a@b.com", "123")).rejects.toThrow(
      "Usuario no encontrado"
    );
  });

  it("LoginUseCase falla con contrasena invalida", async () => {
    const useCase = new LoginUseCase(
      {
        findByEmail: vi.fn().mockResolvedValue({
          id: 1,
          nombre: "U",
          email: "u@x.com",
          password: "hash",
          rol_id: 2
        })
      },
      null,
      { compare: vi.fn().mockReturnValue(false), compareHash: vi.fn().mockReturnValue(false) }
    );

    await expect(useCase.execute("u@x.com", "bad")).rejects.toThrow(
      "Contraseña incorrecta"
    );
  });

  it("LoginUseCase retorna usuario con permisos", async () => {
    const useCase = new LoginUseCase(
      {
        findByEmail: vi.fn().mockResolvedValue({
          id: 3,
          nombre: "Ana",
          email: "ana@x.com",
          password: "hash",
          rol_id: 1
        })
      },
      {
        getPermisosByRol: vi.fn().mockResolvedValue(["ADMIN_TOTAL"])
      },
      { compareHash: vi.fn().mockReturnValue(true) }
    );

    const result = await useCase.execute("ana@x.com", "123");

    expect(result).toEqual({
      id: 3,
      nombre: "Ana",
      email: "ana@x.com",
      rol: 1,
      permisos: ["ADMIN_TOTAL"]
    });
  });

  it("LoginUseCase tolera error en consulta de permisos", async () => {
    const useCase = new LoginUseCase(
      {
        findByEmail: vi.fn().mockResolvedValue({
          id: 4,
          nombre: "Ben",
          email: "ben@x.com",
          password: "hash",
          rol_id: 4
        })
      },
      {
        getPermisosByRol: vi.fn().mockRejectedValue(new Error("db"))
      },
      { compare: vi.fn().mockReturnValue(true) }
    );

    const result = await useCase.execute("ben@x.com", "ok");
    expect(result.permisos).toEqual([]);
  });

  it("RegistroUseCase valida confirmacion de password", async () => {
    const useCase = new RegistroUseCase(
      { findByEmail: vi.fn() },
      { hash: vi.fn() }
    );

    await expect(
      useCase.execute({
        nombre: "Test User",
        email: "a@b.com",
        password: "Admin123!Strong",
        confirm_password: "Admin123!Wrong"
      })
    ).rejects.toThrow("Las contrase");
  });

  it("RegistroUseCase valida email existente", async () => {
    const useCase = new RegistroUseCase(
      { findByEmail: vi.fn().mockResolvedValue({ id: 1 }) },
      { hash: vi.fn() }
    );

    await expect(
      useCase.execute({
        nombre: "Test User",
        email: "a@b.com",
        password: "Admin123!Strong",
        confirm_password: "Admin123!Strong"
      })
    ).rejects.toThrow("El email ya");
  });

  it("RegistroUseCase crea usuario con rol por defecto", async () => {
    const repo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 99, email: "new@x.com" })
    };
    const hashService = { hash: vi.fn().mockReturnValue("hashed") };
    const useCase = new RegistroUseCase(repo, hashService);

    const result = await useCase.execute({
      nombre: "Nuevo",
      email: "new@x.com",
      password: "Admin123!Strong",
      confirm_password: "Admin123!Strong"
    });

    expect(hashService.hash).toHaveBeenCalledWith("Admin123!Strong");
    expect(repo.create).toHaveBeenCalledWith({
      nombre: "Nuevo",
      email: "new@x.com",
      password: "hashed",
      rol_id: 3
    });
    expect(result).toEqual({ id: 99, email: "new@x.com" });
  });

  it("RegistrarLog delega en create", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ ok: true }) };
    const useCase = new RegistrarLog(repo);

    const payload = { usuario_id: 1, accion: "CREAR" };
    const result = await useCase.ejecutar(payload);

    expect(repo.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ ok: true });
  });

  it("CrearEntidad valida nombre y tipo", async () => {
    const useCase = new CrearEntidad(
      { create: vi.fn() },
      { execute: vi.fn() }
    );

    await expect(useCase.execute({ nombre: "", tipo: "" }, 1)).rejects.toThrow(
      "Nombre y tipo son obligatorios"
    );
  });

  it("CrearEntidad crea y registra auditoria", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: 33, nombre: "E" }) };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearEntidad(repo, logUseCase);

    const result = await useCase.execute({ nombre: "X", tipo: "Cliente" }, 5);

    expect(repo.create).toHaveBeenCalledWith({ nombre: "X", tipo: "Cliente" });
    expect(logUseCase.execute).toHaveBeenCalledWith({
      usuario_id: 5,
      accion: "CREAR",
      modulo: "ENTIDAD",
      referencia_id: 33
    });
    expect(result).toEqual({ id: 33, nombre: "E" });
  });

  it("CrearEntidad valida duplicados y direccion opcional", async () => {
    const repoDuplicada = {
      findByNombreNormalized: vi.fn().mockResolvedValue({ id: 8 }),
      create: vi.fn()
    };
    const useCaseDuplicada = new CrearEntidad(repoDuplicada, { execute: vi.fn() });
    await expect(useCaseDuplicada.execute({ nombre: "X", tipo: "Sede" }, 1)).rejects.toThrow("Ya existe");

    const repo = {
      findByNombreNormalized: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 88, nombre: "Nueva" })
    };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearEntidad(repo, logUseCase);
    await useCase.execute({ nombre: "Nueva", tipo: "Sede", direccion: "Calle 1" }, 2);
    expect(repo.create).toHaveBeenCalledWith({
      nombre: "Nueva",
      tipo: "Sede",
      direccion: "Calle 1"
    });
  });

  it("ListarEntidades delega findAll", async () => {
    const repo = { findAll: vi.fn().mockResolvedValue([{ id: 1 }]) };
    const useCase = new ListarEntidades(repo);

    const result = await useCase.execute();

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("CrearOrden exige mantenimientos", async () => {
    const useCase = new CrearOrden({ create: vi.fn() });
    await expect(useCase.execute({ mantenimientos: [] })).rejects.toThrow(
      "Debe incluir mantenimientos"
    );
  });

  it("CrearOrden crea orden", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: 10 }) };
    const useCase = new CrearOrden(repo);

    const payload = { numero: "OT-1", mantenimientos: [1] };
    const result = await useCase.execute(payload);

    expect(repo.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ id: 10 });
  });

  it("FirmarOrden delega firma", async () => {
    const repo = { firmar: vi.fn().mockResolvedValue({ ok: true }) };
    const useCase = new FirmarOrden(repo);

    const result = await useCase.execute(3, "base64", 7);

    expect(repo.firmar).toHaveBeenCalledWith(3, "base64", 7);
    expect(result).toEqual({ ok: true });
  });

  it("FirmarOrden registra log cuando se proporciona use case", async () => {
    const repo = { firmar: vi.fn().mockResolvedValue({ ok: true }) };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new FirmarOrden(repo, logUseCase);

    await useCase.execute(5, "firma", 2);
    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 2, accion: "FIRMAR_ORDEN", entidad_id: 5 })
    );
  });

  it("GenerarPDF delega en servicio", async () => {
    const service = { generar: vi.fn().mockResolvedValue("pdf-buffer") };
    const useCase = new GenerarPDF(service);

    const result = await useCase.execute({ id: 1 });

    expect(service.generar).toHaveBeenCalledWith({ id: 1 });
    expect(result).toBe("pdf-buffer");
  });

  it("ResetPasswordUseCase valida usuario objetivo y resetea password", async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 2, rol_id: 3 }),
      updatePassword: vi.fn().mockResolvedValue(undefined),
      setDebeCambiarPassword: vi.fn().mockResolvedValue(undefined)
    };
    const hashService = { hash: vi.fn().mockResolvedValue("hashed-temp") };
    const useCase = new ResetPasswordUseCase(repo, hashService);

    const result = await useCase.execute(1, 2, "Temporal123!", true);

    expect(hashService.hash).toHaveBeenCalledWith("Temporal123!");
    expect(repo.updatePassword).toHaveBeenCalledWith(2, "hashed-temp");
    expect(repo.setDebeCambiarPassword).toHaveBeenCalledWith(2, true);
    expect(result.message).toContain("reseteada");
  });

  it("ResetPasswordUseCase falla si el usuario no existe o es otro admin", async () => {
    const repoNoUser = { findById: vi.fn().mockResolvedValue(null) };
    const useCaseNoUser = new ResetPasswordUseCase(repoNoUser, { hash: vi.fn() });
    await expect(useCaseNoUser.execute(1, 99, "x")).rejects.toThrow("Usuario no encontrado");

    const repoAdmin = { findById: vi.fn().mockResolvedValue({ id: 3, rol_id: 1 }) };
    const useCaseAdmin = new ResetPasswordUseCase(repoAdmin, { hash: vi.fn() });
    await expect(useCaseAdmin.execute(1, 3, "x")).rejects.toThrow("No puedes resetear");
  });

  it("LoginUseCase valida email/password requeridos y privilegio admin", async () => {
    const useCase = new LoginUseCase(
      {
        findByEmail: vi.fn().mockResolvedValue({
          id: 1,
          nombre: "Admin",
          email: "admin@x.com",
          password: "hash",
          rol_id: 1
        })
      },
      { getPermisosByRol: vi.fn().mockResolvedValue(["VER_ACTIVOS"]) },
      { compareHash: vi.fn().mockResolvedValue(true) }
    );

    await expect(useCase.execute("", "123")).rejects.toThrow("Email es requerido");
    await expect(useCase.execute("admin@x.com", "")).rejects.toThrow("Contrase");

    const result = await useCase.execute("admin@x.com", "123");
    expect(result.permisos).toContain("ADMIN_TOTAL");
  });

  it("LoginUseCase usa permisos personalizados cuando existen", async () => {
    const useCase = new LoginUseCase(
      {
        findByEmail: vi.fn().mockResolvedValue({
          id: 5,
          nombre: "Param",
          email: "param@x.com",
          password: "hash",
          rol_id: 3
        }),
        getDebeCambiarPassword: vi.fn().mockResolvedValue(true)
      },
      {
        getPermisosByRol: vi.fn().mockResolvedValue(["VER_ACTIVOS"]),
        getPermisosByUsuario: vi.fn().mockResolvedValue(["VER_ACTIVOS", "CREAR_ACTIVO"])
      },
      { compare: vi.fn().mockResolvedValue(true) }
    );

    const result = await useCase.execute("param@x.com", "123");
    expect(result.permisos).toEqual(["VER_ACTIVOS", "CREAR_ACTIVO"]);
    expect(result.debe_cambiar_password).toBe(true);
  });

  it("RegistroUseCase valida estructura, nombre, email y password", async () => {
    const useCase = new RegistroUseCase(
      { findByEmail: vi.fn().mockResolvedValue(null), create: vi.fn() },
      { hash: vi.fn().mockResolvedValue("hash") }
    );

    await expect(useCase.execute(null)).rejects.toThrow("Datos de registro");
    await expect(
      useCase.execute({ nombre: "A", email: "ok@x.com", password: "123456" })
    ).rejects.toThrow("Nombre debe tener");
    await expect(
      useCase.execute({ nombre: "Nombre", email: "bad-email", password: "123456" })
    ).rejects.toThrow("Email inv");
    await expect(
      useCase.execute({ nombre: "Nombre", email: "ok@x.com", password: "123" })
    ).rejects.toThrow(/contraseña/i);
  });

  it("RegistrarLog normaliza payload en execute", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ ok: true }) };
    const useCase = new RegistrarLog(repo);

    await useCase.execute({
      usuarioId: 8,
      accion: "ACCION_X",
      modulo: "MODULO",
      referencia_id: 77,
      detalles: { ok: 1 }
    });
    expect(repo.create).toHaveBeenCalledWith({
      usuario_id: 8,
      accion: "ACCION_X",
      entidad: "MODULO",
      entidad_id: 77,
      antes: null,
      despues: { ok: 1 },
      ip: null
    });

    await useCase.execute(5, "ACCION_Y", 12, "SISTEMA");
    expect(repo.create).toHaveBeenLastCalledWith({
      usuario_id: 5,
      accion: "ACCION_Y",
      entidad: "SISTEMA",
      entidad_id: 12,
      antes: null,
      despues: null,
      ip: null
    });

    expect(useCase.normalizePayload(null)).toMatchObject({
      accion: "ACCION_DESCONOCIDA",
      entidad: "SISTEMA"
    });
  });

  it("EditarEntidad valida reglas de actualizacion", async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 4, nombre: "A", tipo: "T", direccion: "D" }),
      findByNombreNormalized: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 4, nombre: "B", tipo: "T", direccion: "D2" })
    };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new EditarEntidad(repo, logUseCase);

    await expect(useCase.execute("x", {})).rejects.toThrow("ID de entidad invalido");
    await expect(useCase.execute(1, {})).rejects.toThrow("No hay datos");
    await expect(useCase.execute(1, { nombre: " " })).rejects.toThrow("nombre es obligatorio");
    await expect(useCase.execute(1, { tipo: " " })).rejects.toThrow("tipo es obligatorio");

    repo.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute(33, { nombre: "X" })).rejects.toThrow("Entidad no existe");

    repo.findById.mockResolvedValueOnce({ id: 4, nombre: "A", tipo: "T", direccion: "D" });
    repo.findByNombreNormalized.mockResolvedValueOnce({ id: 8, nombre: "Duplicada" });
    await expect(useCase.execute(4, { nombre: "Duplicada" })).rejects.toThrow("Ya existe");

    repo.findById.mockResolvedValueOnce({ id: 4, nombre: "A", tipo: "T", direccion: "D" });
    repo.findByNombreNormalized.mockResolvedValueOnce(null);
    repo.update.mockResolvedValueOnce(null);
    await expect(useCase.execute(4, { nombre: "Nueva" })).rejects.toThrow("No se pudo actualizar");

    const updated = await useCase.execute(4, { nombre: "B", direccion: "D2" }, 9);
    expect(updated).toMatchObject({ id: 4, nombre: "B" });
    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 9, accion: "EDITAR", entidad_id: 4 })
    );
  });

  it("EliminarEntidad y ObtenerEntidad validan existencia", async () => {
    const repo = {
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const eliminarUseCase = new EliminarEntidad(repo, logUseCase);
    const obtenerUseCase = new ObtenerEntidad(repo);

    await expect(obtenerUseCase.execute("x")).rejects.toThrow("ID de entidad invalido");
    repo.findById.mockResolvedValueOnce(null);
    await expect(obtenerUseCase.execute(2)).rejects.toThrow("Entidad no existe");

    repo.findById.mockResolvedValueOnce({ id: 3, nombre: "Ent", tipo: "Sede" });
    const entidad = await obtenerUseCase.execute(3);
    expect(entidad.id).toBe(3);

    await expect(eliminarUseCase.execute("bad")).rejects.toThrow("ID de entidad invalido");
    repo.findById.mockResolvedValueOnce(null);
    await expect(eliminarUseCase.execute(44)).rejects.toThrow("Entidad no existe");

    repo.findById.mockResolvedValueOnce({ id: 4, nombre: "Ent", tipo: "Sede", direccion: "X" });
    const deleted = await eliminarUseCase.execute(4, 10);
    expect(deleted).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(4);
    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 10, accion: "ELIMINAR", entidad_id: 4 })
    );
  });

  it("EnviarCorreo valida destinatarios, asunto y contenido", async () => {
    const provider = { send: vi.fn().mockResolvedValue({ accepted: ["ok@x.com"], rejected: [], messageId: "m1" }) };
    const useCase = new EnviarCorreo(provider);

    await expect(useCase.execute({})).rejects.toThrow("al menos un correo");
    await expect(useCase.execute({ to: "bad", subject: "A", text: "B" })).rejects.toThrow("Correo invalido");
    await expect(useCase.execute({ to: "ok@x.com", text: "B" })).rejects.toThrow("asunto");
    await expect(useCase.execute({ to: "ok@x.com", subject: "A" })).rejects.toThrow("texto o html");

    const result = await useCase.execute(
      { to: "ok@x.com, ok2@x.com", subject: "Aviso", text: "Hola" },
      { replyTo: "reply@x.com" }
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ok@x.com, ok2@x.com",
        subject: "Aviso",
        text: "Hola",
        replyTo: "reply@x.com"
      })
    );
    expect(result.accepted).toContain("ok@x.com");
  });

  it("CrearOrden aplica defaults, log y rutas auxiliares", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: 90, numero: "OT-90" }) };
    const logUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    const useCase = new CrearOrden(repo, logUseCase);

    await useCase.execute({ mantenimientos: [1], creado_por: 7 }, null);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        creado_por: 7,
        estado: "Generada",
        mantenimientos: [1]
      })
    );
    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accion: "CREAR_ORDEN", entidad_id: 90 })
    );

    repo.create.mockClear();
    const noUserUseCase = new CrearOrden(repo);
    await noUserUseCase.execute({ numero: "OT-X", mantenimientos: [5] }, null);
    expect(repo.create).toHaveBeenCalledWith({ numero: "OT-X", mantenimientos: [5] });
  });

  it("ListarOrden, ObtenerOrden y EliminarOrden delegan repositorio", async () => {
    const repo = {
      findAll: vi.fn().mockResolvedValue([{ id: 1 }]),
      findById: vi.fn().mockResolvedValue({ id: 2 }),
      delete: vi.fn().mockResolvedValue(true)
    };

    const listar = new ListarOrden(repo);
    const obtener = new ObtenerOrden(repo);
    const eliminar = new EliminarOrden(repo);

    expect(await listar.execute()).toEqual([{ id: 1 }]);
    expect(await obtener.execute(2)).toEqual({ id: 2 });
    expect(await eliminar.execute(2)).toBe(true);
  });
});
