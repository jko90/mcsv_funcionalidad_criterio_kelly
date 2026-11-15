export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}
