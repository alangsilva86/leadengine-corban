import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SimulationPreview from '../SimulationPreview.jsx';

describe('SimulationPreview', () => {
  it('avisa quando não há janela vigente', () => {
    render(<SimulationPreview products={['Consignado']} windows={[]} taxes={[]} />);
    expect(screen.getByText(/sem janela vigente/i)).toBeInTheDocument();
  });

  it('renderiza métricas quando há dados válidos', () => {
    const today = new Date();
    const windows = [
      { id: 'w', label: 'Atual', start: today, end: new Date(today.getTime() + 86400000), firstDueDate: new Date(today.getTime() + 2 * 86400000) },
    ];
    const taxes = [
      {
        id: 't',
        produto: 'Consignado',
        modalidade: 'NORMAL',
        monthlyRate: 2,
        tacPercent: 0,
        tacFlat: 0,
        validFrom: new Date(today.getTime() - 86400000),
        validUntil: new Date(today.getTime() + 86400000),
        status: 'Ativa',
      },
    ];

    render(<SimulationPreview products={['Consignado']} windows={windows} taxes={taxes} />);
    expect(screen.getByText(/coeficiente estimado/i)).toBeInTheDocument();
  });
});
