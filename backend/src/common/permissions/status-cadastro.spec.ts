import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { assertPodeAlterarStatus } from './status-cadastro';
import type { AuthenticatedUser } from '../types/authenticated-user';

const user = (cargo: AuthenticatedUser['cargo']): AuthenticatedUser => ({
  id: 1,
  nome: 'X',
  email: 'x@exemplo.test',
  cargo,
});

describe('assertPodeAlterarStatus', () => {
  it('operador edita campos comuns, mas não muda `ativo`', () => {
    expect(() => assertPodeAlterarStatus(user('OPERADOR'), {})).not.toThrow();
    expect(() =>
      assertPodeAlterarStatus(user('OPERADOR'), { ativo: false }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertPodeAlterarStatus(user('OPERADOR'), { ativo: true }),
    ).toThrow(ForbiddenException);
  });

  it('gerente e administrador ativam e inativam', () => {
    expect(() =>
      assertPodeAlterarStatus(user('GERENTE'), { ativo: false }),
    ).not.toThrow();
    expect(() =>
      assertPodeAlterarStatus(user('ADMINISTRADOR'), { ativo: true }),
    ).not.toThrow();
  });
});
