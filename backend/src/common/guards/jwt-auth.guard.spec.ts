import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

const makeContext = (authorization?: string) => {
  const request: Record<string, unknown> = { headers: { authorization } };
  const context = {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
};

const makeGuard = (payload: Record<string, unknown> | Error) => {
  const jwt = {
    verifyAsync: vi.fn(() =>
      payload instanceof Error
        ? Promise.reject(payload)
        : Promise.resolve(payload),
    ),
  } as unknown as JwtService;
  const config = { get: vi.fn(() => 'segredo') } as unknown as ConfigService;
  const reflector = {
    getAllAndOverride: vi.fn(() => false),
  } as unknown as Reflector;
  return new JwtAuthGuard(jwt, config, reflector);
};

describe('JwtAuthGuard', () => {
  it('aceita access token válido e anexa o usuário', async () => {
    const guard = makeGuard({
      sub: 1,
      nome: 'Ana',
      email: 'a@b.c',
      cargo: 'OPERADOR',
    });
    const { context, request } = makeContext('Bearer token-ok');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 1, cargo: 'OPERADOR' });
  });

  it('rejeita token de desbloqueio do financeiro usado como Bearer', async () => {
    const guard = makeGuard({ sub: 1, purpose: 'financeiro_unlock' });
    const { context } = makeContext('Bearer token-de-desbloqueio');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita requisição sem token', async () => {
    const guard = makeGuard({});
    const { context } = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
