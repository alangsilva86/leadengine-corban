import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { EmptyState } from './EmptyState.jsx';

/**
 * Estado de erro padrão: mensagem humana + "Tentar novamente".
 * O detalhe técnico fica escondido num <details>, útil para o suporte.
 *
 * @param {object} props
 * @param {string} [props.title]
 * @param {unknown} [props.error] Erro original; vira uma frase legível.
 * @param {string} [props.description] Sobrescreve a frase derivada do erro.
 * @param {() => void} [props.onRetry]
 * @param {'default'|'compact'} [props.size]
 */
export function ErrorState({
  title = 'Não foi possível carregar',
  error,
  description,
  onRetry,
  retryLabel = 'Tentar novamente',
  size = 'default',
  className,
}) {
  const message = description ?? getFriendlyErrorMessage(error);
  const technical =
    error && (error.status || error.message)
      ? [error.status ? `HTTP ${error.status}` : null, error.message].filter(Boolean).join(' · ')
      : null;

  return (
    <EmptyState
      role="alert"
      icon={AlertTriangle}
      tone="error"
      size={size}
      title={title}
      description={message}
      className={className}
      action={
        onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            {retryLabel}
          </Button>
        ) : null
      }
    >
      {technical && technical !== message ? (
        <details className="max-w-sm text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
          <p className="mt-1 break-words font-mono">{technical}</p>
        </details>
      ) : null}
    </EmptyState>
  );
}

export default ErrorState;
