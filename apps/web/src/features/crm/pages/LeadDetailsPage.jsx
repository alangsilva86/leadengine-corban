import { useParams } from 'react-router-dom';

const LeadDetailsPage = () => {
  const { leadId } = useParams();

  return (
    <div className="flex h-full flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Lead {leadId}</h1>
        <p className="text-muted-foreground">
          Detalhes aprofundados do lead serão exibidos aqui conforme as etapas futuras do CRM forem implementadas.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
        Placeholder do drawer e conteúdo detalhado do lead.
      </div>
    </div>
  );
};

export default LeadDetailsPage;
