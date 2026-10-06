import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Cargo } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { getRequest } from '../http/get-request';

/**
 * Guard de RBAC. Lê os cargos exigidos via @Roles e compara com o cargo do
 * usuário autenticado. Deve rodar depois do JwtAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Cargo[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = getRequest(context);
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !requiredRoles.includes(user.cargo)) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }
    return true;
  }
}
