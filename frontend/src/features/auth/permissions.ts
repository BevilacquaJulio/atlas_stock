import type { Cargo } from './auth.types';

/** Espelha a API: ativar/inativar cadastros é de gerente e administrador. */
export function podeAlterarStatus(cargo?: Cargo): boolean {
  return cargo === 'ADMINISTRADOR' || cargo === 'GERENTE';
}
