import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { LOG_REDACT_PATHS } from './log-redact';

describe('LOG_REDACT_PATHS', () => {
  it('mascara bearer e token de desbloqueio financeiro', () => {
    const lines: string[] = [];
    const logger = pino(
      { redact: LOG_REDACT_PATHS },
      { write: (line: string) => lines.push(line) },
    );

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer MARCADOR-BEARER',
          'x-financeiro-token': 'MARCADOR-FINANCEIRO',
          cookie: 'MARCADOR-COOKIE',
        },
      },
    });

    const out = lines.join('');
    expect(out).not.toContain('MARCADOR-');
    expect(out).toContain('[Redacted]');
  });
});
