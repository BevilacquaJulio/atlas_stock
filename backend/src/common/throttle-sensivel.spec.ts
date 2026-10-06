import { describe, it, expect } from 'vitest';
import { AuthController } from '../modules/auth/auth.controller';
import { FinanceiroController } from '../modules/financeiro/financeiro.controller';

const limite = (handler: object) =>
  Reflect.getMetadata('THROTTLER:LIMITdefault', handler) as number | undefined;

describe('rate limit de rotas sensíveis', () => {
  it('login tem limite estrito', () => {
    expect(limite(AuthController.prototype.login)).toBeLessThanOrEqual(10);
  });

  it('refresh tem limite estrito', () => {
    expect(limite(AuthController.prototype.refresh)).toBeLessThanOrEqual(30);
  });

  it('desbloqueio do financeiro (senha compartilhada) tem limite estrito', () => {
    expect(limite(FinanceiroController.prototype.desbloquear)).toBeLessThanOrEqual(
      10,
    );
  });
});
