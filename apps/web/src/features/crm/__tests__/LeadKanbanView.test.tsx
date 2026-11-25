/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/api.js', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  apiPost: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn(), info: vi.fn() },
}));

import LeadKanbanView from '../views/LeadKanbanView';
import { CrmViewProvider } from '../state/view-context';

type ServerLead = { id: string; name: string; stage: string; contactId?: string; ownerId: null; ownerName: null; lastActivityAt: null; source: null; channel: null; status: 'new' };

const lead = (id: string, name: string, stage: string): ServerLead => ({
  id,
  name,
  stage,
  ownerId: null,
  ownerName: null,
  lastActivityAt: null,
  source: null,
  channel: null,
  status: 'new',
});

let serverLeads: ServerLead[] = [];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderBoard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CrmViewProvider filters={{ stages: [], owners: [], origins: [], channels: [], score: null, dateRange: null, inactivityDays: null }}>
          <LeadKanbanView />
        </CrmViewProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const column = (stage: string) => document.querySelector(`[data-stage-column="${stage}"]`) as HTMLElement;

const openMoveMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: `Mover ${name} para outra etapa` }));
  return screen.findByRole('menu');
};

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe('LeadKanbanView', () => {
  beforeEach(() => {
    serverLeads = [lead('l1', 'Ana Souza', 'qualificacao'), lead('l2', 'Bruno Lima', 'perdido'), lead('l3', 'Carla Dias', 'ganho')];
    apiGetMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/crm/leads?')) return { data: { items: serverLeads, total: serverLeads.length, nextCursor: null } };
      return { data: {} };
    });
  });

  afterEach(() => {
    cleanup();
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    toastError.mockReset();
  });

  it('mostra as 7 etapas do funil em ordem e as saídas no fim, com valores antigos normalizados', async () => {
    serverLeads = [lead('l1', 'Ana Souza', 'negotiation'), lead('l2', 'Bruno Lima', 'closed-lost')];
    renderBoard();
    await screen.findByText('Ana Souza');

    const order = Array.from(document.querySelectorAll('[data-stage-column]')).map((node) => node.getAttribute('data-stage-column'));
    expect(order).toEqual(['novo', 'contato', 'qualificacao', 'proposta', 'documentacao', 'averbacao', 'liquidacao', 'ganho', 'perdido', 'reciclar']);
    expect(within(column('documentacao')).getByText('Ana Souza')).toBeInTheDocument();
    expect(within(column('perdido')).getByText('Bruno Lima')).toBeInTheDocument();
  });

  it('move o lead na hora (otimista) e confirma com PATCH /stage', async () => {
    const user = userEvent.setup();
    const pending = deferred<unknown>();
    apiPatchMock.mockReturnValue(pending.promise);
    renderBoard();
    await screen.findByText('Ana Souza');

    const menu = await openMoveMenu(user, 'Ana Souza');
    await user.click(within(menu).getByRole('menuitemradio', { name: /Proposta/ }));

    await waitFor(() => expect(within(column('proposta')).getByText('Ana Souza')).toBeInTheDocument());
    expect(within(column('qualificacao')).queryByText('Ana Souza')).not.toBeInTheDocument();
    expect(apiPatchMock).toHaveBeenCalledWith('/api/crm/leads/l1/stage', { stage: 'proposta' });

    serverLeads = serverLeads.map((entry) => (entry.id === 'l1' ? { ...entry, stage: 'proposta' } : entry));
    pending.resolve({ success: true, data: serverLeads[0] });
    await waitFor(() => expect(within(column('proposta')).getByText('Ana Souza')).toBeInTheDocument());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('desfaz a mudança e mostra a mensagem do servidor quando a API recusa (409)', async () => {
    const user = userEvent.setup();
    const pending = deferred<unknown>();
    apiPatchMock.mockReturnValue(pending.promise);
    renderBoard();
    await screen.findByText('Ana Souza');

    const menu = await openMoveMenu(user, 'Ana Souza');
    await user.click(within(menu).getByRole('menuitemradio', { name: /Averbação/ }));
    await waitFor(() => expect(within(column('averbacao')).getByText('Ana Souza')).toBeInTheDocument());

    const conflict = Object.assign(new Error('Este lead já foi encerrado por outra pessoa.'), {
      status: 409,
      payload: { error: { code: 'INVALID_STAGE_TRANSITION', message: 'Este lead já foi encerrado por outra pessoa.' } },
    });
    pending.reject(conflict);

    await waitFor(() => expect(within(column('qualificacao')).getByText('Ana Souza')).toBeInTheDocument());
    expect(within(column('averbacao')).queryByText('Ana Souza')).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      'Não foi possível mover Ana Souza para Averbação',
      expect.objectContaining({ description: 'Este lead já foi encerrado por outra pessoa.' })
    );
  });

  it('só oferece transições permitidas: Perdido → Reciclar; Ganho não arrasta nem muda', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText('Bruno Lima');

    const menu = await openMoveMenu(user, 'Bruno Lima');
    const enabled = within(menu)
      .getAllByRole('menuitemradio')
      .filter((item) => item.getAttribute('aria-disabled') !== 'true' && !item.hasAttribute('data-disabled'))
      .map((item) => item.textContent);
    expect(enabled).toEqual([expect.stringContaining('Perdido'), expect.stringContaining('Reciclar')]);
    expect(within(menu).getByText('Lead perdido só pode voltar para Reciclar.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const wonCard = within(column('ganho')).getByRole('button', { name: 'Abrir lead Carla Dias' });
    expect(wonCard).not.toHaveAttribute('data-rfd-drag-handle-draggable-id');
    expect(apiPatchMock).not.toHaveBeenCalled();
  });

  it('compacta etapas vazias (continuam alvos de soltar) e rola até a primeira etapa com leads', async () => {
    serverLeads = [lead('l1', 'Ana Souza', 'averbacao')];
    const scrollTo = vi.fn();
    const rect = (left: number, width: number) => ({ left, right: left + width, top: 0, bottom: 100, width, height: 100, x: left, y: 0, toJSON: () => ({}) });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-slot') === 'scroll-area-viewport') return rect(0, 390) as DOMRect;
      const stage = this.getAttribute('data-stage-column');
      // 5 colunas compactas (64 px + 12 px de espaço) antes de Averbação.
      if (stage === 'averbacao') return rect(5 * 76, 264) as DOMRect;
      return rect(0, 0) as DOMRect;
    });
    // jsdom não implementa `Element.scrollTo`.
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scrollTo, configurable: true, writable: true });

    renderBoard();
    await screen.findByText('Ana Souza');

    for (const stage of ['novo', 'contato', 'qualificacao', 'proposta', 'documentacao', 'liquidacao']) {
      expect(column(stage)).toHaveAttribute('data-compact', 'true');
      expect(column(stage).querySelector('[data-rfd-droppable-id]')).toHaveAttribute('data-rfd-droppable-id', stage);
    }
    expect(column('averbacao')).not.toHaveAttribute('data-compact');
    expect(within(column('novo')).getByRole('heading')).toHaveTextContent('0 leads em Novo');

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith({ left: 5 * 76 - 4, behavior: 'smooth' });

    rectSpy.mockRestore();
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
  });
});
