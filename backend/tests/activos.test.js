import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";

let token;
let activoId;

describe("ACTIVOS API", () => {
  const testEmail = `admin.activos.${Date.now()}.${Math.random().toString(36).slice(2)}@admin.com`;

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
  });

  it("Debe listar activos", async () => {
    const res = await request(app)
      .get("/api/activos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("Debe crear un activo", async () => {
    const res = await request(app)
      .post("/api/activos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sede: "Principal",
        numeroReporte: "REP-001",
        activo: "ACT-001",
        areaPrincipal: "Tecnologia",
        equipo: "Laptop",
        marca: "Dell",
        modelo: "Latitude 5420",
        estado: "Disponible"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    activoId = res.body.data.id;
  });

  it("Debe actualizar un activo", async () => {
    const res = await request(app)
      .put(`/api/activos/${activoId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        estado: "Mantenimiento"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("Debe eliminar un activo", async () => {
    const res = await request(app)
      .delete(`/api/activos/${activoId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

});

