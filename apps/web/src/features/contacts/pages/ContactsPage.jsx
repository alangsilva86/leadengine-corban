import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, SearchX, Users } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { EmptyState, ErrorState, PageHeader } from '@/components/page';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import useCrmPermissions from '@/features/crm/state/permissions';
import { buildInboxHref, pluralize } from '@/features/crm/utils/labels';
import ContactsToolbar, { EMPTY_CONTACT_FILTERS, countActiveFilters } from '../components/ContactsToolbar.jsx';
import ContactsTable from '../components/ContactsTable.jsx';
import ContactCreateDialog from '../components/ContactCreateDialog.jsx';
import ContactTaskDialog from '../components/ContactTaskDialog.jsx';
import ContactQuickEditDrawer from '../components/ContactQuickEditDrawer.jsx';
import ContactBulkTagDialog from '../components/ContactBulkTagDialog.jsx';
import ContactMergeDialog from '../components/ContactMergeDialog.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import {
  useContactBulkMutation,
  useContactLeadIndex,
  useContactTagsQuery,
  useContactsQuery,
  useCreateContactMutation,
  useMergeContactsMutation,
  useUpdateContactMutation,
} from '../hooks/useContactsApi.js';
import useContactsLiveUpdates from '../hooks/useContactsLiveUpdates.js';

/** Telefone/CPF formatado ("(62) 99977-6655") vira só dígitos para casar com o que está salvo. */
const normalizeSearchTerm = (value) => {
  const term = value.trim();
  if (/^[\d\s()+\-./]+$/.test(term)) {
    const digits = term.replace(/\D/g, '');
    return digits.length >= 4 ? digits : term;
  }
  return term;
};

const ContactsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canViewSensitiveData } = useCrmPermissions();
  const canMerge = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => ({ ...EMPTY_CONTACT_FILTERS }));
  const [sort, setSort] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [taskContact, setTaskContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [isTagDialogOpen, setTagDialogOpen] = useState(false);
  const [isMergeDialogOpen, setMergeDialogOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryFilters = useMemo(() => {
    const { status, ...rest } = filters;
    return {
      ...rest,
      ...(status && status !== 'all' ? { status } : {}),
      ...(sort ? { sortBy: sort.sortBy, sortOrder: sort.sortOrder } : {}),
      search: normalizeSearchTerm(debouncedSearch),
    };
  }, [filters, debouncedSearch, sort]);

  const contactsQuery = useContactsQuery({ filters: queryFilters, pageSize: 50 });
  const tagsQuery = useContactTagsQuery();
  const leadIndexQuery = useContactLeadIndex();
  const bulkMutation = useContactBulkMutation();
  const mergeMutation = useMergeContactsMutation();
  const createContactMutation = useCreateContactMutation();
  const updateMutation = useUpdateContactMutation(editingContact?.id);
  useContactsLiveUpdates({ enabled: true });

  const contacts = useMemo(
    () => contactsQuery.data?.pages?.flatMap((page) => page.items ?? []) ?? [],
    [contactsQuery.data]
  );
  const totalContacts = contactsQuery.data?.pages?.[0]?.pagination?.total ?? undefined;
  const selectedContacts = useMemo(() => contacts.filter((contact) => selectedIds.has(contact.id)), [contacts, selectedIds]);
  const hasQuery = Boolean(debouncedSearch.trim()) || countActiveFilters(filters) > 0;

  const handleToggleSelection = useCallback((contactId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(
    (checked) => setSelectedIds(checked ? new Set(contacts.map((contact) => contact.id)) : new Set()),
    [contacts]
  );

  const handleOpenDetails = useCallback(
    (contact) => {
      if (contact?.id) navigate(`/contacts/${contact.id}`);
    },
    [navigate]
  );

  const handleOpenConversation = useCallback(
    (contact) => navigate(buildInboxHref(contact?.id)),
    [navigate]
  );

  const handleCreateContact = useCallback(
    async (payload) => {
      try {
        const result = await createContactMutation.mutateAsync(payload);
        toast.success('Contato criado.');
        setCreateDialogOpen(false);
        if (result?.id) {
          navigate(`/contacts/${result.id}`);
        }
        return result;
      } catch (error) {
        throw new Error(getFriendlyErrorMessage(error, 'Não foi possível criar o contato.'));
      }
    },
    [createContactMutation, navigate]
  );

  const handleAddTag = (tag) => {
    const ids = Array.from(selectedIds);
    bulkMutation.mutate(
      { contactIds: ids, addTags: [tag] },
      {
        onSuccess: () => {
          toast.success(ids.length === 1 ? `Tag "${tag}" adicionada.` : `Tag "${tag}" adicionada a ${ids.length} contatos.`);
          setTagDialogOpen(false);
          setSelectedIds(new Set());
        },
        onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível adicionar a tag.')),
      }
    );
  };

  const handleMerge = ({ targetId, sourceIds }) => {
    mergeMutation.mutate(
      { targetId, sourceIds },
      {
        onSuccess: () => {
          toast.success('Contatos mesclados.');
          setMergeDialogOpen(false);
          setSelectedIds(new Set());
        },
        onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível mesclar os contatos.')),
      }
    );
  };

  const handleUpdateContact = (payload) => {
    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Contato atualizado.');
        setEditingContact(null);
      },
      onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Não foi possível atualizar o contato.')),
    });
  };

  const clearAll = () => {
    setSearch('');
    setFilters({ ...EMPTY_CONTACT_FILTERS });
  };

  const emptyState = contactsQuery.isError ? (
    <ErrorState
      title="Não foi possível carregar os contatos"
      error={contactsQuery.error}
      onRetry={() => contactsQuery.refetch()}
    />
  ) : hasQuery ? (
    <EmptyState
      icon={SearchX}
      title="Nenhum contato encontrado"
      description="Confira a grafia ou tente buscar pelo telefone com DDD."
      action={
        <Button type="button" variant="outline" size="sm" onClick={clearAll}>
          Limpar busca e filtros
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Users}
      title="Nenhum contato ainda"
      description="Os contatos chegam sozinhos pelas conversas do WhatsApp. Você também pode cadastrar um manualmente."
      action={
        <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus aria-hidden="true" />
          Novo contato
        </Button>
      }
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Contatos"
        meta={
          typeof totalContacts === 'number' ? (
            <span className="tabular-nums">{pluralize(totalContacts, 'contato', 'contatos')}</span>
          ) : null
        }
        actions={
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus aria-hidden="true" />
            Novo contato
          </Button>
        }
      />

      <ContactsToolbar
        searchValue={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={() => {
          contactsQuery.refetch();
          leadIndexQuery.refetch();
        }}
        isRefreshing={contactsQuery.isFetching && !contactsQuery.isLoading}
        availableTags={tagsQuery.data ?? []}
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onAddTag={() => setTagDialogOpen(true)}
        onMerge={() => setMergeDialogOpen(true)}
        canMerge={canMerge}
        isBulkProcessing={bulkMutation.isPending || mergeMutation.isPending}
      />

      <ContactsTable
        contacts={contacts}
        leadIndex={leadIndexQuery.data?.index}
        leadIndexReady={Boolean(leadIndexQuery.data?.complete)}
        selectedIds={selectedIds}
        onToggle={handleToggleSelection}
        onToggleAll={handleToggleAll}
        sort={sort}
        onSortChange={setSort}
        onOpenDetails={handleOpenDetails}
        onOpenConversation={handleOpenConversation}
        onCreateTask={setTaskContact}
        onEdit={setEditingContact}
        fetchNextPage={contactsQuery.fetchNextPage}
        hasNextPage={contactsQuery.hasNextPage}
        isFetchingNextPage={contactsQuery.isFetchingNextPage}
        isLoading={contactsQuery.isLoading}
        totalCount={totalContacts}
        emptyState={emptyState}
      />

      <ContactCreateDialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={handleCreateContact} />
      <ContactTaskDialog
        open={Boolean(taskContact)}
        onOpenChange={(open) => (!open ? setTaskContact(null) : undefined)}
        contact={taskContact}
      />
      <ContactQuickEditDrawer
        open={Boolean(editingContact)}
        onOpenChange={(open) => (!open ? setEditingContact(null) : undefined)}
        contact={editingContact}
        onSubmit={handleUpdateContact}
        isSubmitting={updateMutation.isPending}
        canViewSensitiveData={canViewSensitiveData}
      />
      <ContactBulkTagDialog
        open={isTagDialogOpen}
        onOpenChange={setTagDialogOpen}
        count={selectedIds.size}
        availableTags={tagsQuery.data ?? []}
        onSubmit={handleAddTag}
        isSubmitting={bulkMutation.isPending}
      />
      {canMerge ? (
        <ContactMergeDialog
          open={isMergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          contacts={selectedContacts}
          onConfirm={handleMerge}
          isSubmitting={mergeMutation.isPending}
        />
      ) : null}
    </div>
  );
};

export default ContactsPage;
