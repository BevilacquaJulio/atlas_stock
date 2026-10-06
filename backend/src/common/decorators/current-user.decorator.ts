import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { getRequest } from '../http/get-request';

/**
 * Injeta o usuário autenticado (anexado pelo JwtAuthGuard) no handler.
 * Uso: `@CurrentUser() user: AuthenticatedUser`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = getRequest(ctx);
    return request.user as AuthenticatedUser;
  },
);
