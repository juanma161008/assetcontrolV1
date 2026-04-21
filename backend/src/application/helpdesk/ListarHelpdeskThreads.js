export default class ListarHelpdeskThreads {
  constructor(helpdeskRepository) {
    this.helpdeskRepository = helpdeskRepository;
  }

  async execute(filters = {}) {
    return this.helpdeskRepository.findThreads(filters);
  }
}
