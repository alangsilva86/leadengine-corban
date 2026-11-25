/**
 * Mensagens de erro em pt-BR para o usuário final.
 * Nunca mostre `statusText` ("Not Found", "Service Unavailable") nem códigos crus na interface.
 */
const STATUS_MESSAGES = {
  0: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  400: 'Alguns dados não foram aceitos. Revise e tente de novo.',
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  403: 'Você não tem permissão para fazer isso.',
  404: 'Não encontramos o que você procurou.',
  408: 'O servidor demorou para responder. Tente de novo.',
  409: 'Esta informação foi alterada por outra pessoa. Atualize a página e tente de novo.',
  413: 'O arquivo é grande demais.',
  422: 'Alguns dados não foram aceitos. Revise e tente de novo.',
  429: 'Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.',
  500: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  502: 'O serviço está instável no momento. Tente de novo em alguns minutos.',
  503: 'O serviço está instável no momento. Tente de novo em alguns minutos.',
  504: 'O servidor demorou para responder. Tente de novo.',
};

const GENERIC_MESSAGE = 'Algo deu errado. Tente de novo.';

// Textos técnicos que às vezes chegam como "message" e não devem ir para a tela.
const TECHNICAL_PATTERNS = [
  /^(not found|bad request|unauthorized|forbidden|internal server error|service unavailable|bad gateway|gateway timeout)$/i,
  /^failed to fetch$/i,
  /^networkerror/i,
  /^load failed$/i,
  /^request failed with status/i,
];

const isTechnicalMessage = (message) =>
  typeof message !== 'string' || !message.trim() || TECHNICAL_PATTERNS.some((pattern) => pattern.test(message.trim()));

export const getStatusMessage = (status) => {
  if (typeof status !== 'number') return null;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return STATUS_MESSAGES[500];
  if (status >= 400) return STATUS_MESSAGES[400];
  return null;
};

/**
 * Converte qualquer erro em uma frase legível.
 * Prioriza a mensagem da API quando ela é humana; senão usa o status HTTP; por fim o fallback.
 */
export const getFriendlyErrorMessage = (error, fallback = GENERIC_MESSAGE) => {
  if (!error) return fallback;
  const apiMessage = error?.payload?.error?.message ?? error?.message;
  if (!isTechnicalMessage(apiMessage)) {
    return apiMessage.trim();
  }
  const isNetworkError = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(error?.message ?? ''));
  if (isNetworkError) return STATUS_MESSAGES[0];
  return getStatusMessage(error?.status) ?? fallback;
};

export default getFriendlyErrorMessage;
