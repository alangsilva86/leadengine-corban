import { cn } from '@/lib/utils.js';
import { useDocumentTitle } from '@/hooks/use-document-title.js';

/**
 * Cabeçalho padrão de página: título (h1), descrição curta e ações.
 * Também atualiza o título da aba do navegador.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title
 * @param {import('react').ReactNode} [props.description]
 * @param {import('react').ReactNode} [props.actions] Botões à direita (ação principal por último).
 * @param {import('react').ReactNode} [props.meta] Linha de contexto abaixo da descrição (contagens, status).
 * @param {string} [props.documentTitle] Sobrescreve o título da aba quando `title` não for texto.
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.children]
 */
export function PageHeader({ title, description, actions, meta, documentTitle, className, children }) {
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : undefined));

  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        {meta ? <div className="pt-1 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      {children}
    </header>
  );
}

export default PageHeader;
