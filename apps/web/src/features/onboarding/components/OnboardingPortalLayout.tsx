import { ReactNode } from 'react';
import { Ticket } from 'lucide-react';

import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

export type OnboardingStage = {
  id: string;
  label: string;
};

export type OnboardingPortalLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onboarding?: {
    stages: OnboardingStage[];
    activeStep: number;
  };
  accent?: ReactNode;
};

const StageTrack = ({ stages, activeStep }: { stages: OnboardingStage[]; activeStep: number }) => {
  if (!stages?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {stages.map((stage, index) => {
        const status = index < activeStep ? 'done' : index === activeStep ? 'current' : 'todo';
        return (
          <Badge
            key={stage.id}
            variant="outline"
            className={cn(
              'gap-2 border-dashed px-3 py-1.5 font-medium',
              status === 'done' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
              status === 'current' && 'border-primary/40 bg-primary/10 text-primary',
              status === 'todo' && 'border-muted-foreground/30 text-muted-foreground'
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border text-[0.7rem] font-semibold">
              {index + 1}
            </span>
            {stage.label}
          </Badge>
        );
      })}
    </div>
  );
};

const OnboardingPortalLayout = ({ title, description, children, onboarding, accent }: OnboardingPortalLayoutProps) => {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">LeadEngine Onboarding</p>
            <p className="text-xs text-muted-foreground">Configure sua operação em minutos</p>
          </div>
        </div>
        {onboarding?.stages?.length ? (
          <StageTrack stages={onboarding.stages} activeStep={onboarding.activeStep} />
        ) : null}
        <Card className="border border-border/60 bg-background/95 p-6 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
              </div>
              {accent}
            </div>
          </div>
          <div className="mt-6 space-y-4">{children}</div>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingPortalLayout;
