import { MantenimientoApi } from "./MantenimientoAPI.js";

export class MantenimientoService {
  constructor() {
    this.api = new MantenimientoApi();
  }

  async getAll() {
    return await this.api.getAll();
  }

  async create(mantenimiento) {
    return await this.api.create(mantenimiento);
  }

  async update(id, mantenimiento) {
    return await this.api.update(id, mantenimiento);
  }

  async delete(id) {
    return await this.api.delete(id);
  }
}
