import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

const base = {
  MYSQL_HOST: 'db',
  MYSQL_USER: 'u',
  MYSQL_DATABASE: 'd',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('aceita configuração mínima sem SSL', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('falha no boot quando MYSQL_SSL=true sem MYSQL_SSL_CA_PATH', () => {
    expect(() => validateEnv({ ...base, MYSQL_SSL: 'true' })).toThrow(
      /MYSQL_SSL_CA_PATH/,
    );
  });

  it('aceita MYSQL_SSL=true com o caminho da CA', () => {
    expect(() =>
      validateEnv({
        ...base,
        MYSQL_SSL: 'true',
        MYSQL_SSL_CA_PATH: '/run/secrets/ca.pem',
      }),
    ).not.toThrow();
  });
});
