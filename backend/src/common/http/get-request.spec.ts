import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { getRequest } from './get-request';

describe('getRequest', () => {
  it('retorna a request HTTP em contexto REST', () => {
    const req = { id: 'http' };
    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(getRequest(ctx)).toBe(req);
  });

  it('retorna context.req em contexto GraphQL', () => {
    const req = { id: 'gql' };
    // args do resolver: [root, args, context, info]
    const ctx = {
      getType: () => 'graphql',
      getClass: () => undefined,
      getHandler: () => undefined,
      getArgs: () => [{}, {}, { req }, {}],
    } as unknown as ExecutionContext;

    expect(getRequest(ctx)).toBe(req);
  });
});
