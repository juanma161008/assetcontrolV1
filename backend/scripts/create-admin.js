import RegistroUseCase from "../src/application/auth/RegistroUseCase.js";
import UsuarioPgRepository from "../src/infrastructure/repositories/UsuarioPgRepository.js";
import hashUtil from "../src/utils/hash.js";
import pool from "../src/infrastructure/database/postgres.js";
import { generateStrongPassword, validatePassword } from "../src/utils/passwordPolicy.js";

const userRepo = new UsuarioPgRepository(pool);
const registroUseCase = new RegistroUseCase(userRepo, hashUtil);

const buildAdminPassword = () => {
  const providedPassword = String(process.env.ADMIN_PASSWORD || "").trim();
  if (providedPassword) {
    const validation = validatePassword(providedPassword);
    if (!validation.valid) {
      throw new Error("ADMIN_PASSWORD no cumple la politica de seguridad");
    }
    return providedPassword;
  }

  return generateStrongPassword(16);
};

async function createAdmin() {
  try {
    const adminPassword = buildAdminPassword();
    const adminData = {
      nombre: String(process.env.ADMIN_NAME || "Admin").trim(),
      email: String(process.env.ADMIN_EMAIL || "admin@assetcontrol.com").trim().toLowerCase(),
      password: adminPassword,
      confirm_password: adminPassword
    };

    // Cambiar temporalmente el rol a 1 (admin)
    const originalExecute = registroUseCase.execute.bind(registroUseCase);
    registroUseCase.execute = async (data) => {
      const result = await originalExecute(data);
      await pool.query("UPDATE usuarios SET rol_id = 1 WHERE id = $1", [result.id]);
      return { ...result, rol_id: 1 };
    };

    const admin = await registroUseCase.execute(adminData);
    console.log("Admin creado exitosamente:", {
      id: admin.id,
      nombre: admin.nombre,
      email: admin.email,
      rol_id: admin.rol_id
    });

    if (!process.env.ADMIN_PASSWORD) {
      console.log(`Contraseña temporal generada: ${adminPassword}`);
    }
  } catch (error) {
    console.error("Error creando admin:", error.message);
  } finally {
    await pool.end();
  }
}

createAdmin();
