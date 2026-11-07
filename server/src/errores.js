'use strict';

/** Error que se le muestra tal cual al usuario (con su código HTTP). */
class ErrorHttp extends Error {
  constructor(estado, mensaje, detalle) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.detalle = detalle;
  }
}

module.exports = { ErrorHttp };
