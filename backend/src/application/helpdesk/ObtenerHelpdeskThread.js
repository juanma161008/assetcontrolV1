export default class ObtenerHelpdeskThread {
  constructor(helpdeskRepository) {
    this.helpdeskRepository = helpdeskRepository;
  }

  async execute(threadId) {
    return this.helpdeskRepository.findThreadById(Number(threadId));
  }
}
