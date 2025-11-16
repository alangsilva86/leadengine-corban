import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistoryCard from '../HistoryCard.jsx';

describe('HistoryCard', () => {
  it('exibe mensagem padrão quando não há histórico', () => {
    render(<HistoryCard history={[]} />);
    expect(screen.getByText(/assim que taxas/i)).toBeInTheDocument();
  });

  it('ordena e renderiza entradas do histórico', () => {
    const history = [
      { id: '1', message: 'Primeira', author: 'Ana', createdAt: new Date('2024-01-01') },
      { id: '2', message: 'Mais recente', author: 'Bruno', createdAt: new Date('2024-02-01') },
    ];
    render(<HistoryCard history={history} />);

    const messages = screen.getAllByText(/Primeira|Mais recente/).map((node) => node.textContent);
    expect(messages[0]).toContain('Mais recente');
  });
});
