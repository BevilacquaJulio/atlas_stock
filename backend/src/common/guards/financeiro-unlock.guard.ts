import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { FINANCEIRO_UNLOCK_KEY } from '../decorators/financeiro-unlock.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

interface FinanceiroUnlockPayload {
  purpose: string;
  sub: number;
}

@Injectable()
export class FinanceiroUnlockGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresUnlock = this.reflector.getAllAndOverride<boolean>(
      FINANCEIRO_UNLOCK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresUnlock) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (user?.cargo === 'ADMINISTRADOR') return true;

    const token = request.headers['x-financeiro-token'];
    if (!token || typeof token !== 'string') {
      throw new ForbiddenException(
        'Módulo financeiro bloqueado. Informe a senha de desbloqueio.',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<FinanceiroUnlockPayload>(
        token,
        { secret: this.config.get<string>('JWT_ACCESS_SECRET') },
      );
      if (payload.purpose !== 'financeiro_unlock' || payload.sub !== user?.id) {
        throw new ForbiddenException('Token de desbloqueio inválido.');
      }
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('Token de desbloqueio inválido ou expirado.');
    }
  }
}
