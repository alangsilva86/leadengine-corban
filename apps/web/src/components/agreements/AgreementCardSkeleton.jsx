import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';

const AgreementCardSkeleton = ({ className = '', ...cardProps }) => (
  <Card className={`border-[var(--border)] ${className}`} {...cardProps}>
    <CardHeader>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </CardContent>
    <CardFooter className="flex items-center justify-between">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-9 w-32 rounded-full" />
    </CardFooter>
  </Card>
);
const AgreementCardSkeleton = ({ className }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </CardFooter>
    </Card>
  );
};

export default AgreementCardSkeleton;
