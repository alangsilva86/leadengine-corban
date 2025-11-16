import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaxesCard from '../TaxesCard.jsx';
import TaxDialog from '../TaxDialog.jsx';

const sampleTaxes = [
  {
    id: 'tax-1',
    produto: 'Cartão benefício – Saque',
    modalidade: 'NORMAL',
    monthlyRate: 2.5,
    tacPercent: 1,
    tacFlat: 0,
    validFrom: new Date('2024-01-01'),
    validUntil: null,
    status: 'Ativa',
  },
];

describe('TaxesCard', () => {
  it('exibe mensagem quando não há taxas para o produto', () => {
    render(
      <TaxesCard
        products={['Cartão benefício – Saque']}
        taxes={[]}
        onUpsert={vi.fn()}
        readOnly={false}
      />
    );

    expect(screen.getByText(/nenhuma taxa cadastrada/i)).toBeInTheDocument();
  });
});

describe('TaxDialog', () => {
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    globalThis.crypto = { randomUUID: () => 'tax-generated' };
  });

  afterAll(() => {
    globalThis.crypto = originalCrypto;
  });

  it('envia dados de taxa válidos', () => {
    const handleSubmit = vi.fn();
    render(
      <TaxDialog open onClose={vi.fn()} onSubmit={handleSubmit} initialValue={null} disabled={false} />
    );

    fireEvent.change(screen.getByLabelText(/taxa ao mês/i), { target: { value: '2.1' } });
    fireEvent.change(screen.getByLabelText(/vigente a partir/i), { target: { value: '2024-01-01' } });
    fireEvent.submit(screen.getByRole('button', { name: /salvar taxa/i }));

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tax-generated', monthlyRate: 2.1 })
    );
  });
});
