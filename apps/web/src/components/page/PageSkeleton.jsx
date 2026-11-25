import { Skeleton } from '@/components/ui/skeleton.jsx';

/** Esqueleto genérico enquanto uma página carrega (no lugar de "Carregando módulo..."). */
export function PageSkeleton({ label = 'Carregando página…' }) {
  return (
    <div className="flex w-full flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default PageSkeleton;
