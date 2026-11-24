/** Headers com credenciais que nunca podem chegar ao log (bearer e desbloqueio financeiro). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-financeiro-token"]',
  'req.headers.cookie',
];
