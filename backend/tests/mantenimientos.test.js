import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";

let token;
let activoId;
let mantenimientoId;

describe("MANTENIMIENTOS API", () => {
  const testEmail = `admin.mant.${Date.now()}.${Math.random().toString(36).slice(2)}@admin.com`;

  beforeAll(async () => {

    await request(app)
      .post("/api/auth/registro")
      .send({
        nombre: "Admin Test",
        email: testEmail,
        password: "Admin123!Strong",
        confirm_password: "Admin123!Strong",
        permisos: ["ADMIN_TOTAL"]
      });

    const login = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: "Admin123!Strong"
      });

    token = login.body.data.token;

    // Crear activo real para relacionar mantenimiento
    const activo = await request(app)
      .post("/api/activos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sede: "Principal",
        numeroReporte: "REP-002",
        activo: "ACT-002",
        areaPrincipal: "Tecnologia",
        equipo: "PC",
        marca: "HP",
        modelo: "EliteDesk",
        estado: "Disponible"
      });

    activoId = activo.body.data.id;
  });

  it("Debe listar mantenimientos", async () => {
    const res = await request(app)
      .get("/api/mantenimientos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("Debe crear un mantenimiento", async () => {
    const res = await request(app)
      .post("/api/mantenimientos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fecha: "2026-01-01",
        activo: activoId,
        tipo: "Preventivo",
        tecnico: "Juanma",
        descripcion: "Limpieza general"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    mantenimientoId = res.body.data.id;
  });

  it("Debe actualizar un mantenimiento", async () => {
    const res = await request(app)
      .put(`/api/mantenimientos/${mantenimientoId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        descripcion: "Limpieza y actualización de software"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("Debe eliminar un mantenimiento", async () => {
    const res = await request(app)
      .delete(`/api/mantenimientos/${mantenimientoId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

});

