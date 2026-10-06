import { describe, it, expect, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

const run = (exception: unknown) => {
  const json = vi.fn();
  const status = vi.fn((_code: number) => ({ json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/x' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return {
    status: status.mock.calls[0]?.[0] as number,
    body: json.mock.calls[0]?.[0] as { error: { code: string; message: string } },
  };
};

const prismaError = (code: string) =>
  Object.assign(new Error('detalhe interno do driver'), {
    code,
    clientVersion: '7.0.0',
    name: 'PrismaClientKnownRequestError',
  });

describe('AllExceptionsFilter — erros do Prisma', () => {
  it('P2002 (unicidade) vira 409 sem vazar detalhe interno', () => {
    const { status, body } = run(prismaError('P2002'));
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).not.toContain('driver');
  });

  it('P2003 (chave estrangeira) vira 409', () => {
    expect(run(prismaError('P2003')).status).toBe(409);
  });

  it('P2025 (registro não encontrado) vira 404', () => {
    expect(run(prismaError('P2025')).status).toBe(404);
  });

  it('erro desconhecido continua 500 genérico', () => {
    const { status, body } = run(new Error('boom'));
    expect(status).toBe(500);
    expect(body.error.message).toBe('Erro interno do servidor.');
  });
});
