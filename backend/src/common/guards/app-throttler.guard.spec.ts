import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from './app-throttler.guard';

const makeGuard = () =>
  new AppThrottlerGuard(
    { throttlers: [{ ttl: 1000, limit: 1 }] },
    {} as never,
    new Reflector(),
  );

// getRequestResponse é protegido; o teste acessa o contrato interno de propósito.
const requestResponse = (guard: AppThrottlerGuard, ctx: ExecutionContext) =>
  (
    guard as unknown as {
      getRequestResponse(c: ExecutionContext): { req: unknown; res: unknown };
    }
  ).getRequestResponse(ctx);

describe('AppThrottlerGuard', () => {
  it('em GraphQL usa req/res do contexto do resolver', () => {
    const req = { ip: '1.1.1.1' };
    const res = { header: () => undefined };
    const ctx = {
      getType: () => 'graphql',
      getClass: () => undefined,
      getHandler: () => undefined,
      getArgs: () => [{}, {}, { req, res }, {}],
    } as unknown as ExecutionContext;

    const result = requestResponse(makeGuard(), ctx);

    expect(result.req).toBe(req);
    expect(result.res).toBe(res);
  });

  it('em REST mantém o comportamento padrão', () => {
    const req = { ip: '2.2.2.2' };
    const res = {};
    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;

    const result = requestResponse(makeGuard(), ctx);

    expect(result.req).toBe(req);
    expect(result.res).toBe(res);
  });
});
