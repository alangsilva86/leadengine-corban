import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import TenantAdminLayout from '../components/TenantAdminLayout';
import TenantForm from '../components/TenantForm';
import { useTenantDetails } from '../hooks/useTenantDetails';
import { useCreateTenant, useToggleTenantActive, useUpdateTenant } from '../hooks/useTenantMutations';
import type { TenantFormState } from '../types';
import { readTenantAdminError } from '../utils';

const parseSettings = (settingsText: string) => {
  if (!settingsText.trim()) {
    return {};
  }
  try {
    return JSON.parse(settingsText);
  } catch (error) {
    console.error('Invalid settings JSON', error);
    throw new Error('JSON de settings inválido.');
  }
};

const TenantFormPage = () => {
  const params = useParams<{ tenantId?: string }>();
  const tenantId = params.tenantId;
  const isCreate = !tenantId;
  const navigate = useNavigate();

  const detailsQuery = useTenantDetails(tenantId);
  const createMutation = useCreateTenant();
  const updateMutation = useUpdateTenant();
  const toggleMutation = useToggleTenantActive();

  const defaultValues = useMemo<TenantFormState | null>(() => {
    if (!detailsQuery.data) {
      return null;
    }
    return {
      name: detailsQuery.data.name,
      slug: detailsQuery.data.slug,
      isActive: detailsQuery.data.isActive,
      settingsText: JSON.stringify(detailsQuery.data.settings ?? {}, null, 2),
    };
  }, [detailsQuery.data]);

  const handleSubmit = async (values: TenantFormState) => {
    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        settings: parseSettings(values.settingsText),
      };

      if (isCreate) {
        const tenant = await createMutation.mutateAsync(payload);
        if (!values.isActive) {
          await toggleMutation.mutateAsync({ id: tenant.id, isActive: false });
        }
        toast.success('Tenant criado com sucesso.');
        navigate(`/admin/tenants/${tenant.id}`, { replace: true });
        return;
      }

      if (!tenantId) {
        return;
      }

      await updateMutation.mutateAsync({ id: tenantId, payload });
      toast.success('Tenant atualizado com sucesso.');
      await detailsQuery.refetch();
    } catch (error) {
      toast.error(readTenantAdminError(error));
    }
  };

  const handleBack = () => {
    navigate('/admin/tenants');
  };

  const handleToggle = async (isActive: boolean) => {
    if (!tenantId) {
      return;
    }
    try {
      await toggleMutation.mutateAsync({ id: tenantId, isActive });
      toast.success(isActive ? 'Tenant ativado.' : 'Tenant desativado.');
    } catch (error) {
      toast.error(readTenantAdminError(error));
    }
  };

  const pageTitle = isCreate ? 'Criar tenant' : 'Editar tenant';
  const pageDescription = isCreate
    ? 'Configure um novo tenant e prepare o terreno para planos e features.'
    : 'Atualize dados do tenant e ajuste configurações avançadas.';

  return (
    <TenantAdminLayout title={pageTitle} description={pageDescription}>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
      {!isCreate && detailsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar tenant</AlertTitle>
          <AlertDescription>{readTenantAdminError(detailsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <TenantForm
          mode={isCreate ? 'create' : 'edit'}
          defaultValues={isCreate ? null : defaultValues}
          loading={detailsQuery.isLoading}
          submitting={createMutation.isPending || updateMutation.isPending}
          toggleLoading={toggleMutation.isPending}
          onSubmit={handleSubmit}
          onToggleActive={handleToggle}
        />
      </div>
    </TenantAdminLayout>
  );
};

export default TenantFormPage;
