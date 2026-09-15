/**
 * @description Contrato de dados de entrada (Data Transfer Object) para o Use Case de Login.
 * Garante tipagem estrita na camada de aplicação antes da comunicação com o Supabase.
 */
export interface LoginDTO {
  email: string;
  password: string;
}