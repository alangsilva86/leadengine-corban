import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiPost } from '@/lib/api';
import { Loader2, RefreshCw, Copy, Ban } from 'lucide-react';

type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type FilterStatus = InviteStatus | 'all';

type InviteMetadata = {
  notes?: string;
  lastSentAt?: string;
  lastSentBy?: string | null;
  sendCount?: number;
  revokedAt?: string;
  revokedBy?: string | null;
};

type AdminInvite = {
  id: string;
  token: string;
  email: string;
  channel: string;
  organization: string | null;
  tenantSlugHint: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: InviteStatus;
  portalLink: string | null;
  metadata?: InviteMetadata;
};

type ListResponse = {
  success: true;
  data: { invites: AdminInvite[] };
};

type CreateInviteForm = {
  email: string;
  organization: string;
  tenantSlugHint: string;
  channel: 'email' | 'sms';
  expiresInDays: string;
  notes: string;
};

const statusLabels: Record<InviteStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  accepted: { label: 'Aceito', variant: 'default' },
  expired: { label: 'Expirado', variant: 'outline' },
  revoked: { label: 'Revogado', variant: 'destructive' },
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

const buildFiltersQuery = (search: string, status: FilterStatus) => {
  const params = new URLSearchParams();
  if (search.trim().length >= 2) {
    params.set('search', search.trim());
  }
  if (status !== 'all') {
    params.set('status', status);
  }
  params.set('limit', '50');
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

const defaultForm: CreateInviteForm = {
  email: '',
  organization: '',
  tenantSlugHint: '',
  channel: 'email',
  expiresInDays: '14',
  notes: '',
};

const OnboardingInvitesTab = () => {
  const [filters, setFilters] = useState<{ search: string; status: FilterStatus }>({ search: '', status: 'all' });
  const [form, setForm] = useState<CreateInviteForm>(defaultForm);
  const [activeResendId, setActiveResendId] = useState<string | null>(null);
  const [activeRevokeId, setActiveRevokeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const invitesQueryKey = ['onboarding-invitations', filters.search, filters.status];

  const invitesQuery = useQuery<AdminInvite[]>({
    queryKey: invitesQueryKey,
    queryFn: async () => {
      const query = buildFiltersQuery(filters.search, filters.status);
      const response = (await apiGet(`/api/onboarding/invitations${query}`)) as ListResponse;
      return response.data.invites;
    },
  });

  const invalidateInvites = () => queryClient.invalidateQueries({ queryKey: invitesQueryKey });

  const createInviteMutation = useMutation({
    mutationFn: async (payload: Partial<CreateInviteForm>) => apiPost('/api/onboarding/invitations', payload),
    onSuccess: () => {
      toast.success('Convite emitido e enviado.');
      invalidateInvites();
      setForm(defaultForm);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (inviteId: string) => apiPost(`/api/onboarding/invitations/${inviteId}/resend`, {}),
    onMutate: (inviteId: string) => {
      setActiveResendId(inviteId);
    },
    onSuccess: () => {
      toast.success('Convite reenviado com sucesso.');
      invalidateInvites();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setActiveResendId(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ inviteId, reason }: { inviteId: string; reason?: string }) =>
      apiPost(`/api/onboarding/invitations/${inviteId}/revoke`, reason ? { reason } : {}),
    onMutate: ({ inviteId }) => {
      setActiveRevokeId(inviteId);
    },
    onSuccess: () => {
      toast.success('Convite revogado.');
      invalidateInvites();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setActiveRevokeId(null);
    },
  });

const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email.trim()) {
      toast.error('Informe o e-mail do operador.');
      return;
    }

    const payload: Partial<CreateInviteForm> & { expiresInDays?: number } = {
      email: form.email.trim(),
      organization: form.organization.trim() || undefined,
      tenantSlugHint: form.tenantSlugHint.trim() || undefined,
      channel: form.channel,
      notes: form.notes.trim() || undefined,
    };

    const expires = Number(form.expiresInDays);
    if (!Number.isNaN(expires) && expires > 0) {
      payload.expiresInDays = expires;
    }

    createInviteMutation.mutate(payload);
  };

  const invites = invitesQuery.data ?? [];

  const pendingLabel = useMemo(() => {
    if (invitesQuery.isLoading) {
      return 'Carregando convites...';
    }
    if (invites.length === 0) {
      return 'Nenhum convite encontrado.';
    }
    return `${invites.length} convites encontrados.`;
  }, [invites.length, invitesQuery.isLoading]);

  const handleCopyLink = async (link: string | null) => {
    if (!link) {
      toast.error('Link indisponível. Reenvie o convite para gerar um novo.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error('Clipboard indisponível neste dispositivo.');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const isCreating = createInviteMutation.isPending;

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, status: event.target.value as FilterStatus }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Emitir novo convite</CardTitle>
          <CardDescription>Gere tokens e envie o link do portal sem sair do dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateInvite} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail do operador *</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="operador@cliente.com"
                value={form.email}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-organization">Organização</Label>
              <Input
                id="invite-organization"
                name="organization"
                placeholder="Nome exibido para o cliente"
                value={form.organization}
                onChange={handleFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-slug">Sugestão de slug</Label>
              <Input
                id="invite-slug"
                name="tenantSlugHint"
                placeholder="ex.: cliente-xyz"
                value={form.tenantSlugHint}
                onChange={handleFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-channel">Canal</Label>
              <select
                id="invite-channel"
                name="channel"
                value={form.channel}
                onChange={handleFormChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-expires">Validade (dias)</Label>
              <Input
                id="invite-expires"
                name="expiresInDays"
                type="number"
                min={1}
                max={60}
                value={form.expiresInDays}
                onChange={handleFormChange}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="invite-notes">Anotações internas</Label>
              <Textarea
                id="invite-notes"
                name="notes"
                rows={3}
                placeholder="Observações úteis para o time de onboarding"
                value={form.notes}
                onChange={handleFormChange}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Emitir convite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Convites gerenciados</CardTitle>
            <CardDescription>{pendingLabel}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por e-mail ou organização"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <select
              value={filters.status}
              onChange={handleStatusChange}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="all">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="accepted">Aceitos</option>
              <option value="expired">Expirados</option>
              <option value="revoked">Revogados</option>
            </select>
            <Button type="button" variant="outline" onClick={() => invalidateInvites()} disabled={invitesQuery.isFetching}>
              {invitesQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invitesQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm textForegroundMuted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando convites...
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm textForegroundMuted">Nenhum convite foi emitido com os filtros atuais.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último envio</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => {
                    const metadata = invite.metadata ?? {};
                    const statusConfig = statusLabels[invite.status];
                    const resendDisabled = invite.status !== 'pending';
                    const revokeDisabled = invite.status !== 'pending';
                    const isResending = activeResendId === invite.id;
                    const isRevoking = activeRevokeId === invite.id;
                    return (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{invite.email}</span>
                            <span className="text-xs textForegroundMuted">Token: {invite.token}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{invite.organization ?? '—'}</span>
                            {metadata.notes ? (
                              <span className="text-xs textForegroundMuted">Obs.: {metadata.notes}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{metadata.lastSentAt ? formatDateTime(metadata.lastSentAt) : 'Nunca enviado'}</span>
                            {metadata.sendCount ? (
                              <span className="text-xs textForegroundMuted">{metadata.sendCount} envio(s)</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>Expira: {formatDateTime(invite.expiresAt)}</span>
                            <span>Criação: {formatDateTime(invite.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyLink(invite.portalLink)}
                            >
                              <Copy className="mr-1 h-4 w-4" />
                              Copiar link
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={resendDisabled || isResending || resendMutation.isPending}
                              onClick={() => resendMutation.mutate(invite.id)}
                            >
                              {isResending ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-1 h-4 w-4" />
                              )}
                              Reenviar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={revokeDisabled || isRevoking || revokeMutation.isPending}
                              onClick={() => revokeMutation.mutate({ inviteId: invite.id })}
                            >
                              {isRevoking ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <Ban className="mr-1 h-4 w-4" />
                              )}
                              Revogar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingInvitesTab;
