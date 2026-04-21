import LogPgRepository from '../../infrastructure/repositories/LogPgRepository.js';

const repo = new LogPgRepository();

export async function getAuditoriaLogs(filters = {}) {
  return await repo.findAll(filters);
}
