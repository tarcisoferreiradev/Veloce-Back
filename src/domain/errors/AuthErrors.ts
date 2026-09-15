// src/domain/errors/AuthErrors.ts

/**
 * @description Classe de erro estendida para falhas de autenticação.
 * Permite que a camada de middleware de erro (Global Interceptor) mapeie
 * automaticamente o statusCode adequado para a resposta HTTP.
 */
export class AuthenticationError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}