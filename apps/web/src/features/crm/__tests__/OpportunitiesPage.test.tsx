/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
}));

vi.mock('@/features/contacts/hooks/useContactsApi.js', () => ({
  useContactDetailsQuery: () => ({ data: { id: 'contact-1', name: 'Carlos Henrique Lima' } }),
}));

import OpportunitiesPage from '../pages/OpportunitiesPage';

const opportunity = {
  id: 'opp-1',
  agreementRef: 'INSS',
  employmentRef: '123',
  productRef: 'Produto QA',
  stage: 'qualificacao',
  version: 1,
  nextAction: 'Revisar dados',
  nextActionAt: null,
  contact: { fullName: 'Carlos Henrique Lima' },
  owner: { name: 'Demo Admin' },
};

const renderPage = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <OpportunitiesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('OpportunitiesPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPatchMock.mockReset();
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });
  });

  it('mostra estado vazio com ação para contatos quando não há oportunidades', async () => {
    apiGetMock.mockResolvedValue({ data: { items: [], nextCursor: null } });
    renderPage('/crm/opportunities');
    expect(screen.getByRole('heading', { level: 1, name: 'Oportunidades' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma oportunidade ainda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver contatos/ })).toHaveAttribute('href', '/contacts');
  });

  it('mantém os campos livres e o fluxo de atualização com select nativo "Etapa"', async () => {
    apiGetMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/crm/opportunities/opp-1')) {
        return { data: { ...opportunity, activities: [{ id: 'a1', stage: 'qualificacao', reason: 'Oportunidade registrada', createdAt: new Date().toISOString() }] } };
      }
      return { data: { items: [opportunity], nextCursor: null } };
    });
    renderPage('/crm/opportunities?contactId=contact-1');

    expect(screen.getByRole('heading', { name: 'Nova oportunidade' })).toBeInTheDocument();
    for (const label of ['Convênio', 'Referência do vínculo', 'Produto', 'Próxima ação']) {
      const field = screen.getByLabelText(label, { exact: true });
      expect(field.tagName).toBe('INPUT');
      fireEvent.change(field, { target: { value: `valor ${label}` } });
      expect(field).toHaveValue(`valor ${label}`);
    }
    expect(screen.getByRole('button', { name: 'Criar oportunidade' })).toBeInTheDocument();

    const item = (await screen.findAllByRole('listitem')).find((entry) => entry.textContent?.includes('Produto QA'))!;
    fireEvent.click(within(item).getByRole('button', { name: 'Atualizar oportunidade' }));
    const select = await within(item).findByRole('combobox', { name: 'Etapa' });
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('qualificacao');
    // Mesmo funil do lead: valores = ids do contrato, rótulos do contrato.
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((option) => option.value)).toEqual([
      'novo',
      'contato',
      'qualificacao',
      'proposta',
      'documentacao',
      'averbacao',
      'liquidacao',
      'ganho',
      'perdido',
      'reciclar',
    ]);
    expect(within(select).getByRole('option', { name: 'Proposta' })).toHaveAttribute('value', 'proposta');
    expect(options.every((option) => !option.disabled)).toBe(true);
    expect(within(item).getByLabelText('Motivo da atualização')).toBeInTheDocument();
    expect(within(item).getByRole('button', { name: 'Salvar atualização' })).toBeInTheDocument();
    await waitFor(() => expect(within(item).getByText(/Qualificação · Oportunidade registrada/)).toBeInTheDocument());
  });
  it('envia a etapa escolhida e mostra o histórico como "<etapa> · <motivo>"', async () => {
    let details = { ...opportunity, activities: [{ id: 'a1', stage: 'qualificacao', reason: 'Oportunidade registrada', createdAt: new Date().toISOString() }] };
    apiGetMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/crm/opportunities/opp-1')) return { data: details };
      return { data: { items: [{ ...opportunity, stage: details.stage }], nextCursor: null } };
    });
    apiPatchMock.mockImplementation(async (_path: string, body: { stage: string; reason: string }) => {
      details = {
        ...details,
        stage: body.stage,
        version: details.version + 1,
        activities: [...details.activities, { id: 'a2', stage: body.stage, reason: body.reason, createdAt: new Date().toISOString() }],
      };
      return { data: details };
    });
    renderPage('/crm/opportunities');

    const item = (await screen.findAllByRole('listitem')).find((entry) => entry.textContent?.includes('Produto QA'))!;
    fireEvent.click(within(item).getByRole('button', { name: 'Atualizar oportunidade' }));
    const select = await within(item).findByRole('combobox', { name: 'Etapa' });
    fireEvent.change(select, { target: { value: 'proposta' } });
    fireEvent.change(within(item).getByLabelText('Motivo da atualização'), { target: { value: 'Dados revisados' } });
    fireEvent.click(within(item).getByRole('button', { name: 'Salvar atualização' }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/api/crm/opportunities/opp-1', expect.objectContaining({ stage: 'proposta', reason: 'Dados revisados' })));
    expect(await within(item).findByText(/Proposta · Dados revisados/)).toBeInTheDocument();
  });

  it('segue as regras do funil: Perdido só vai para Reciclar; Ganho não muda mais', async () => {
    const renderWithStage = async (stage: string) => {
      apiGetMock.mockImplementation(async (path: string) => {
        if (path.startsWith('/api/crm/opportunities/opp-1')) return { data: { ...opportunity, stage, activities: [] } };
        return { data: { items: [{ ...opportunity, stage }], nextCursor: null } };
      });
      const view = renderPage('/crm/opportunities');
      const item = (await screen.findAllByRole('listitem')).find((entry) => entry.textContent?.includes('Produto QA'))!;
      fireEvent.click(within(item).getByRole('button', { name: 'Atualizar oportunidade' }));
      const select = await within(item).findByRole('combobox', { name: 'Etapa' });
      const enabled = (within(select).getAllByRole('option') as HTMLOptionElement[]).filter((option) => !option.disabled).map((option) => option.value);
      return { view, item, enabled };
    };

    const lost = await renderWithStage('perdido');
    expect(lost.enabled).toEqual(['perdido', 'reciclar']);
    expect(within(lost.item).getByText('Lead perdido só pode voltar para Reciclar.')).toBeInTheDocument();
    lost.view.unmount();

    const won = await renderWithStage('ganho');
    expect(won.enabled).toEqual(['ganho']);
    won.view.unmount();

    // Valor antigo (CLOSED/FOLLOW_UP) ainda em cache é normalizado.
    const legacy = await renderWithStage('FOLLOW_UP');
    expect(within(legacy.item).getByRole('combobox', { name: 'Etapa' })).toHaveValue('averbacao');
  });
});
