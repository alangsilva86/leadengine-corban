/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import AgreementCard from '../AgreementCard.jsx';
import AgreementCardSkeleton from '../AgreementCardSkeleton.jsx';

describe('AgreementCard', () => {
  const baseProps = {
    name: 'Convênio Saúde Total',
    description: 'Plano completo para empresas de médio porte',
    region: 'São Paulo',
    availableLeads: 120,
    hotLeads: 45,
    tags: ['Empresas', 'Saúde ocupacional'],
    lastSyncAt: '2024-05-03T12:30:00.000Z',
  };

  afterEach(() => {
    cleanup();
  });

  it('renders agreement information', () => {
    render(<AgreementCard {...baseProps} />);

    expect(screen.getByText(baseProps.name)).toBeInTheDocument();
    expect(screen.getByText(baseProps.description)).toBeInTheDocument();
    expect(screen.getByText(baseProps.region)).toBeInTheDocument();
    expect(screen.getByText(String(baseProps.availableLeads))).toBeInTheDocument();
    expect(screen.getByText(String(baseProps.hotLeads))).toBeInTheDocument();
    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(screen.getByText('Saúde ocupacional')).toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/)).toHaveTextContent(
      `Atualizado em ${new Date(baseProps.lastSyncAt).toLocaleString()}`
    );
  });

  it('highlights the selected state', () => {
    render(<AgreementCard {...baseProps} isSelected />);

    const button = screen.getByRole('button', { name: /Convênio selecionado/i });
    expect(button).toBeInTheDocument();
  });

  it('triggers selection handler', () => {
    const onSelect = vi.fn();
    render(<AgreementCard {...baseProps} onSelect={onSelect} />);

    const button = screen.getByRole('button', { name: /Ativar leads/i });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('AgreementCardSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders skeleton placeholders', () => {
    const { container } = render(<AgreementCardSkeleton />);
    const skeletonElements = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
});
