import { getEnvVar } from './runtime-env.js';

/**
 * Diagnóstico do WhatsApp (eventos brutos do conector).
 * A API só libera esses dados para administradores da plataforma (cabeçalho com token próprio),
 * que o app web não envia. Fica desligado até existir um endpoint por empresa;
 * ligue com VITE_ENABLE_DIAGNOSTICS=true em ambientes de suporte.
 */
export const isDiagnosticsEnabled = () => String(getEnvVar('VITE_ENABLE_DIAGNOSTICS', '')).trim().toLowerCase() === 'true';
