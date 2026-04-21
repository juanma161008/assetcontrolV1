import httpClient from "../../services/httpClient";

export class MantenimientoApi {
  constructor() {
    this.url = "/api/mantenimientos";
  }

  async getAll() {
    const response = await httpClient.get(this.url);
    return response.data.data || response.data || [];
  }

  async create(mantenimiento) {
    const response = await httpClient.post(this.url, mantenimiento);
    return response.data.data || response.data;
  }

  async update(id, mantenimiento) {
    const response = await httpClient.put(`${this.url}/${id}`, mantenimiento);
    return response.data.data || response.data;
  }

  async delete(id) {
    const response = await httpClient.delete(`${this.url}/${id}`);
    return response.data.data || response.data;
  }
}
