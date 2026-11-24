import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { RefreshTokenRepository } from './refresh-token.repository';

describe('AuthService.login', () => {
  let usuarios: { findByEmailWithSenha: ReturnType<typeof vi.fn> };
  let refreshTokens: {
    createEmpty: ReturnType<typeof vi.fn>;
    setHash: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    usuarios = { findByEmailWithSenha: vi.fn() };
    refreshTokens = {
      createEmpty: vi.fn().mockResolvedValue({ id: 10 }),
      setHash: vi.fn().mockResolvedValue(undefined),
    };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
    config = { get: vi.fn().mockReturnValue('7d') };
    service = new AuthService(
      usuarios as unknown as UsuariosRepository,
      refreshTokens as unknown as RefreshTokenRepository,
      jwt as never,
      config as never,
    );
  });

  it('emite tokens com credenciais válidas', async () => {
    const senhaHash = await bcrypt.hash('secret123', 10);
    usuarios.findByEmailWithSenha.mockResolvedValue({
      id: 1,
      nome: 'Admin',
      email: 'a@b.com',
      senha: senhaHash,
      cargo: 'ADMINISTRADOR',
      ativo: true,
    });

    const result = await service.login('a@b.com', 'secret123');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBe('signed.jwt.token');
    expect(result.user).toMatchObject({ id: 1, cargo: 'ADMINISTRADOR' });
  });

  it('rejeita senha incorreta com 401', async () => {
    const senhaHash = await bcrypt.hash('secret123', 10);
    usuarios.findByEmailWithSenha.mockResolvedValue({
      id: 1,
      nome: 'Admin',
      email: 'a@b.com',
      senha: senhaHash,
      cargo: 'OPERADOR',
      ativo: true,
    });
    await expect(service.login('a@b.com', 'errada')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita usuário inativo com 401', async () => {
    usuarios.findByEmailWithSenha.mockResolvedValue({
      id: 1,
      senha: 'x',
      ativo: false,
    });
    await expect(service.login('a@b.com', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.refresh', () => {
  const build = async (consumed: boolean) => {
    const token = 'refresh.jwt.token';
    const refreshTokens = {
      findById: vi.fn().mockResolvedValue({
        id: 5,
        usuarioId: 1,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: await bcrypt.hash(token, 4),
      }),
      consume: vi.fn().mockResolvedValue(consumed),
      revokeAllForUser: vi.fn(),
      createEmpty: vi.fn().mockResolvedValue({ id: 6 }),
      setHash: vi.fn(),
    };
    const usuarios = {
      findById: vi
        .fn()
        .mockResolvedValue({
          id: 1,
          nome: 'A',
          email: 'a@b.com',
          cargo: 'OPERADOR',
          ativo: true,
        }),
    };
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: 1, tokenId: 5 }),
      signAsync: vi.fn().mockResolvedValue('novo.jwt'),
    };
    const service = new AuthService(
      usuarios as unknown as UsuariosRepository,
      refreshTokens as unknown as RefreshTokenRepository,
      jwt as never,
      { get: vi.fn().mockReturnValue('7d') } as never,
    );
    return { service, refreshTokens, token };
  };

  it('quem consome o token recebe um novo par', async () => {
    const { service, refreshTokens, token } = await build(true);
    await expect(service.refresh(token)).resolves.toMatchObject({
      accessToken: 'novo.jwt',
    });
    expect(refreshTokens.consume).toHaveBeenCalledWith(5);
  });

  it('renovação que perdeu a corrida do consumo recebe 401 e não emite sucessor', async () => {
    const { service, refreshTokens, token } = await build(false);
    await expect(service.refresh(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(refreshTokens.createEmpty).not.toHaveBeenCalled();
  });
});
