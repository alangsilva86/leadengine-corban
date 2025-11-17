import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import OnboardingPortalLayout from './OnboardingPortalLayout.tsx';
import type { TeamSetupResult } from './TeamSetupStep.tsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';

export type OnboardingCompleteStepProps = {
  result: TeamSetupResult | null;
  onboarding?: {
    stages: { id: string; label: string }[];
    activeStep: number;
  };
  onRestart: () => void;
};

const OnboardingCompleteStep = ({ result, onboarding, onRestart }: OnboardingCompleteStepProps) => {
  const navigate = useNavigate();

  const handleGoToApp = () => {
    navigate('/', { replace: true });
  };

  return (
    <OnboardingPortalLayout
      title="Tudo pronto!"
      description="Seu workspace já está ativo e pronto para receber conexões WhatsApp e operadores adicionais."
      onboarding={onboarding}
      accent={<div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">Etapa 3 de 3</div>}
    >
      <Card className="border border-emerald-200/70 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Workspace provisionado
          </div>
          <p>
            {result?.tenant?.name ?? 'Sua operação'} foi criada e o operador{' '}
            <strong>{result?.operator?.name ?? result?.operator?.email ?? 'principal'}</strong> já tem acesso administrador.
          </p>
        </div>
      </Card>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Recomendamos convidar novos operadores pelo menu de configurações e concluir o pareamento do WhatsApp agora para
          começar a receber leads.
        </p>
        <p>
          Caso prefira revisar o passo a passo novamente, reinicie o fluxo. Você também pode seguir direto para o painel para
          explorar todos os módulos.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onRestart}>
          Refazer onboarding
        </Button>
        <Button type="button" onClick={handleGoToApp}>
          Ir para o painel
        </Button>
      </div>
    </OnboardingPortalLayout>
  );
};

export default OnboardingCompleteStep;
