/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

import Reports from '../Reports.jsx';

vi.mock('@/lib/api.js', () => ({
  apiGet: vi.fn(),
}));

const { apiGet } = await import('@/lib/api.js');

const createResizeObserverMock = () =>
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(element) {
      this.callback?.([
        { target: element, contentRect: element?.getBoundingClientRect?.() ?? { width: 0, height: 0 } },
      ]);
    }

    unobserve() {}

    disconnect() {}
  };

const buildApiResponse = (overrides = {}) => ({
  success: true,
  data: {
    groupBy: overrides.groupBy ?? 'agreement',
    period: overrides.period ?? {
      from: '2024-04-01T00:00:00.000Z',
      to: '2024-04-07T23:59:59.000Z',
    },
    summary:
      overrides.summary ?? {
        total: 156,
        allocated: 156,
        contacted: 98,
        won: 32,
        lost: 12,
        averageResponseSeconds: 1800,
        conversionRate: 0.2051,
      },
    groups:
      overrides.groups ?? [
        {
          key: 'agreement:saec',
          label: 'SAEC Goiânia',
          metrics: {
            total: 90,
            allocated: 90,
            contacted: 60,
            won: 20,
            lost: 5,
            averageResponseSeconds: 1500,
            conversionRate: 0.2222,
          },
          breakdown: [
            {
              date: '2024-04-06',
              metrics: {
                total: 40,
                allocated: 40,
                contacted: 28,
                won: 10,
                lost: 2,
                averageResponseSeconds: 1200,
                conversionRate: 0.25,
              },
            },
            {
              date: '2024-04-07',
              metrics: {
                total: 50,
                allocated: 50,
                contacted: 32,
                won: 10,
                lost: 3,
                averageResponseSeconds: 1700,
                conversionRate: 0.2,
              },
            },
          ],
        },
        {
          key: 'agreement:econsig',
          label: 'EConsig Londrina',
          metrics: {
            total: 66,
            allocated: 66,
            contacted: 38,
            won: 12,
            lost: 7,
            averageResponseSeconds: 2100,
            conversionRate: 0.1818,
          },
          breakdown: [
            {
              date: '2024-04-06',
              metrics: {
                total: 30,
                allocated: 30,
                contacted: 18,
                won: 6,
                lost: 3,
                averageResponseSeconds: 2000,
                conversionRate: 0.2,
              },
            },
          ],
        },
      ],
    totalGroups: overrides.totalGroups ?? 2,
  },
});

const renderReports = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <Reports />
    </QueryClientProvider>
  );
};

describe('Reports dashboard', () => {
  beforeEach(() => {
    global.ResizeObserver = createResizeObserverMock();
    if (!SVGElement.prototype.getBBox) {
      SVGElement.prototype.getBBox = () => ({ width: 0, height: 0, x: 0, y: 0 });
    }
    apiGet.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('exibe skeleton enquanto dados são carregados', () => {
    apiGet.mockReturnValueOnce(new Promise(() => {}));

    renderReports();

    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
  });

  it('renderiza métricas e tabela após carregamento', async () => {
    apiGet.mockResolvedValueOnce(buildApiResponse());

    renderReports();

    expect(await screen.findByRole('heading', { name: /relatórios e insights/i })).toBeInTheDocument();

    const leadsCard = screen.getByText('Leads recebidos').closest('[data-slot="card"]') ?? screen.getByText('Leads recebidos').parentElement?.parentElement;
    expect(leadsCard).toBeTruthy();
    expect(within(leadsCard).getByText('156')).toBeInTheDocument();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('SAEC Goiânia')).toBeInTheDocument();
    expect(within(table).getByText('EConsig Londrina')).toBeInTheDocument();
    expect(within(table).getByText('90')).toBeInTheDocument();
    expect(within(table).getByText('66')).toBeInTheDocument();
  });

  it('solicita novos dados ao alterar o período', async () => {
    apiGet.mockResolvedValueOnce(buildApiResponse());
    apiGet.mockResolvedValueOnce(
      buildApiResponse({
        summary: {
          total: 240,
          allocated: 240,
          contacted: 180,
          won: 60,
          lost: 30,
          averageResponseSeconds: 900,
          conversionRate: 0.25,
        },
        groups: [
          {
            key: 'agreement:saec',
            label: 'SAEC Goiânia',
            metrics: {
              total: 140,
              allocated: 140,
              contacted: 100,
              won: 40,
              lost: 20,
              averageResponseSeconds: 800,
              conversionRate: 0.2857,
            },
            breakdown: [],
          },
        ],
      })
    );

    renderReports();

    const leadsCard = await screen.findByText('Leads recebidos');
    const leadsCardContainer = leadsCard.closest('[data-slot="card"]') ?? leadsCard.parentElement?.parentElement;
    expect(within(leadsCardContainer).getByText('156')).toBeInTheDocument();

    const thirtyButton = screen.getByRole('button', { name: /30 dias/i });
    await userEvent.click(thirtyButton);

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    const refreshedLeadsCard = screen.getByText('Leads recebidos');
    const refreshedLeadsCardContainer =
      refreshedLeadsCard.closest('[data-slot="card"]') ?? refreshedLeadsCard.parentElement?.parentElement;

    await waitFor(() => expect(within(refreshedLeadsCardContainer).getByText('240')).toBeInTheDocument());

    const [, secondCall] = apiGet.mock.calls;
    const url = secondCall[0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('groupBy')).toBe('agreement');
    expect(params.get('from')).not.toBeNull();
    expect(params.get('to')).not.toBeNull();
  });

  it('recarrega dados quando a dimensão é alterada', async () => {
    apiGet.mockResolvedValueOnce(buildApiResponse());
    apiGet.mockResolvedValueOnce(
      buildApiResponse({
        groupBy: 'instance',
        groups: [
          {
            key: 'instance:centro',
            label: 'Instância Centro',
            metrics: {
              total: 80,
              allocated: 80,
              contacted: 55,
              won: 25,
              lost: 10,
              averageResponseSeconds: 1100,
              conversionRate: 0.3125,
            },
            breakdown: [],
          },
        ],
      })
    );

    renderReports();

    expect(await screen.findByText('SAEC Goiânia')).toBeInTheDocument();

    const dimensionTrigger = screen.getByRole('combobox', { name: /dimensão/i });
    await userEvent.click(dimensionTrigger);
    const instanceOption = await screen.findByRole('option', { name: /instância/i });
    await userEvent.click(instanceOption);

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Instância Centro')).toBeInTheDocument());
  });
});
