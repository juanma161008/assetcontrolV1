import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";

describe("AUTH", () => {
  const testEmail = `admin.auth.${Date.now()}.${Math.random().toString(36).slice(2)}@admin.com`;

  beforeAll(async () => {
    // Crear usuario admin de prueba
    await request(app)
      .post("/api/auth/registro")
      .send({
        nombre: "Admin Test",
        email: testEmail,
        password: "Admin123!Strong",
        confirm_password: "Admin123!Strong",
        permisos: ["ADMIN_TOTAL"]
      });
  });

  it("Debe responder en /", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("AssetControl API");
  });

  it("Debe hacer login correctamente", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: "Admin123!Strong"
      });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

});

