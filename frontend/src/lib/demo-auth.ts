/**
 * Conta demo do portfólio (OPERADOR com dados fictícios). Vai no bundle público
 * de propósito: nunca aponte para um administrador ou usuário real.
 * O botão só aparece quando as duas variáveis existem no build.
 */
export const demoEmail = import.meta.env.VITE_DEMO_EMAIL?.trim() ?? '';
export const demoPassword = import.meta.env.VITE_DEMO_PASSWORD?.trim() ?? '';

export const isDemoLoginEnabled = demoEmail.length > 0 && demoPassword.length > 0;
