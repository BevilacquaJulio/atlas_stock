import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import type {
  AuthenticatedUser,
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../../common/types/authenticated-user';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult = TokenPair & { user: AuthenticatedUser };

type ExpiresIn = JwtSignOptions['expiresIn'];

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, senha: string): Promise<LoginResult> {
    const usuario = await this.usuarios.findByEmailWithSenha(email);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const user: AuthenticatedUser = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
    };
    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const stored = await this.refreshTokens.findById(payload.tokenId);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      // Possível reuso de token — revoga todas as sessões do usuário.
      await this.refreshTokens.revokeAllForUser(stored.usuarioId);
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const usuario = await this.usuarios.findById(payload.sub);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário indisponível.');
    }

    // Rotação: consumo condicional, então só uma de duas renovações simultâneas
    // recebe o novo par. Se a emissão falhar depois, o cliente refaz o login.
    if (!(await this.refreshTokens.consume(stored.id))) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
    return this.issueTokens({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      );
      await this.refreshTokens.revoke(payload.tokenId);
    } catch {
      // Logout é idempotente: token inválido não é erro para o cliente.
    }
  }

  private async issueTokens(user: AuthenticatedUser): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      cargo: user.cargo,
      nome: user.nome,
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as ExpiresIn,
    });

    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseDurationMs(refreshTtl));
    const row = await this.refreshTokens.createEmpty(user.id, expiresAt);

    const refreshPayload: JwtRefreshPayload = { sub: user.id, tokenId: row.id };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtl as ExpiresIn,
    });
    await this.refreshTokens.setHash(row.id, await bcrypt.hash(refreshToken, 10));

    return { accessToken, refreshToken };
  }

  /** Converte '15m' | '7d' | '24h' | '30s' em milissegundos. */
  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unit = match[2];
    const factor: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * factor[unit];
  }
}
