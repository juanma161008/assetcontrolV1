export default class GenerarPDF {
  constructor(pdfService) {
    this.pdfService = pdfService;
  }

  async execute(ordenData) {
    return await this.pdfService.generar(ordenData);
  }
}
