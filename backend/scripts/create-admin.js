import RegistroUseCase from '../src/application/auth/RegistroUseCase.js';
import UsuarioPgRepository from '../src/infrastructure/repositories/UsuarioPgRepository.js';
import hashUtil from '../src/utils/hash.js';
import pool from '../src/infrastructure/database/postgres.js';

const userRepo = new UsuarioPgRepository(pool);

const registroUseCase = new RegistroUseCase(userRepo, hashUtil);

async function createAdmin() {
  try {
    const adminData = {
      nombre: 'Admin',
      email: 'admin@assetcontrol.com',
      password: 'admin123',
      confirm_password: 'admin123'
    };

    // Cambiar temporalmente el rol a 1 (admin)
    const originalExecute = registroUseCase.execute.bind(registroUseCase);
    registroUseCase.execute = async (data) => {
      const result = await originalExecute(data);
      // Actualizar el rol a 1
      await pool.query('UPDATE usuarios SET rol_id = 1 WHERE id = $1', [result.id]);
      return { ...result, rol_id: 1 };
    };

    const admin = await registroUseCase.execute(adminData);
    console.log('Admin creado exitosamente:', admin);
  } catch (error) {
    console.error('Error creando admin:', error.message);
  } finally {
    pool.end();
  }
}
