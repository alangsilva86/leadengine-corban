import { Navigate, useParams } from 'react-router-dom';
import useLeadDetails from '../hooks/useLeadDetails';

/**
 * Rota legada /crm/leads/:leadId. O detalhe do lead vive no painel do CRM e no contato:
 * redireciona para o contato do lead (ou para o CRM, se o lead não existir).
 */
const LeadDetailsPage = () => {
  const { leadId } = useParams();
  const { lead, isLoading, error } = useLeadDetails(leadId ?? null);

  if (lead?.contactId) {
    return <Navigate to={`/contacts/${encodeURIComponent(lead.contactId)}`} replace />;
  }

  if (error || (!isLoading && !lead)) {
    return <Navigate to="/crm" replace />;
  }

  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground" role="status">
      Abrindo lead…
    </div>
  );
};

export default LeadDetailsPage;
