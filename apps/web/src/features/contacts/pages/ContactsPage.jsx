import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ContactsToolbar from '../components/ContactsToolbar.jsx';
import ContactsTable from '../components/ContactsTable.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import {
  useContactBulkMutation,
  useContactsQuery,
} from '../hooks/useContactsApi.js';
import useContactsLiveUpdates from '../hooks/useContactsLiveUpdates.js';

const extractTags = (contacts) => {
  const set = new Set();
  contacts.forEach((contact) => {
    const tags = Array.isArray(contact?.tags) ? contact.tags : [];
    tags.forEach((tag) => {
      if (tag) {
        set.add(tag);
      }
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const ContactsPage = () => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: 'all', tags: [] });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const navigate = useNavigate();

  const debouncedSearch = useDebouncedValue(search, 350);

  const queryFilters = useMemo(() => {
    const { status, ...rest } = filters;
    const resolvedStatus = status && status !== 'all' ? status : undefined;

    return {
      ...rest,
      ...(resolvedStatus ? { status: resolvedStatus } : {}),
      search: debouncedSearch,
    };
  }, [filters, debouncedSearch]);

  const contactsQuery = useContactsQuery({ filters: queryFilters, pageSize: 60 });
  const bulkMutation = useContactBulkMutation();
  useContactsLiveUpdates({ enabled: true });

  const contacts = useMemo(() => {
    if (!contactsQuery.data?.pages) {
      return [];
    }
    return contactsQuery.data.pages.flatMap((page) => page.items ?? []);
  }, [contactsQuery.data]);

  const availableTags = useMemo(() => extractTags(contacts), [contacts]);

  const handleToggleSelection = useCallback(
    (contactId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(contactId)) {
          next.delete(contactId);
        } else {
          next.add(contactId);
        }
        return next;
      });
    },
    []
  );

  const handleOpenDetails = useCallback(
    (contact) => {
      if (!contact?.id) {
        return;
      }
      navigate(`/contacts/${contact.id}`);
    },
    [navigate]
  );

  const handleBulkAction = useCallback(
    (action, contextContact) => {
      const ids = contextContact?.id ? [contextContact.id] : Array.from(selectedIds);
      if (ids.length === 0) {
        return;
      }

      bulkMutation.mutate(
        { action, contactIds: ids },
        {
          onSuccess: () => {
            toast.success('Ação em massa agendada com sucesso.');
            setSelectedIds(new Set());
          },
          onError: (error) => {
            toast.error(error?.message ?? 'Não foi possível executar a ação em massa.');
          },
        }
      );
    },
    [bulkMutation, selectedIds]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <ContactsToolbar
        searchValue={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={() => contactsQuery.refetch()}
        isRefreshing={contactsQuery.isFetching}
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkAction={handleBulkAction}
        isBulkProcessing={bulkMutation.isPending}
        availableTags={availableTags}
      />
      <div className="flex-1">
        <ContactsTable
          contacts={contacts}
          selectedIds={selectedIds}
          onToggle={handleToggleSelection}
          onOpenDetails={handleOpenDetails}
          onTriggerWhatsApp={(contact) => handleBulkAction('sendWhatsApp', contact)}
          onCreateTask={(contact) => handleBulkAction('createTask', contact)}
          fetchNextPage={contactsQuery.fetchNextPage}
          hasNextPage={contactsQuery.hasNextPage}
          isFetchingNextPage={contactsQuery.isFetchingNextPage}
          isLoading={contactsQuery.isLoading}
        />
      </div>
    </div>
  );
};

export default ContactsPage;
