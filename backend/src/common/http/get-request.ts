import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

/**
 * Devolve a request HTTP do Express tanto em rotas REST quanto em resolvers
 * GraphQL. Guards, decorators e o throttler usam isto para que a mesma
 * autenticação/autorização proteja os dois transportes, sem duplicar regra.
 */
export function getRequest(context: ExecutionContext): Request {
  if (context.getType<string>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>()
      .req;
  }
  return context.switchToHttp().getRequest<Request>();
}
