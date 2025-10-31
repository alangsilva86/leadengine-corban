/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import InstanceMetricsTiles from '../InstanceMetricsTiles.jsx';

const surfaceStyles = {
  glassTile: '',
  progressTrack: 'track',
  progressIndicator: 'indicator',
};

const statusCodeMeta = [
  { code: '1', label: '1', description: 'Status 1' },
  { code: '2', label: '2', description: 'Status 2' },
];

describe('InstanceMetricsTiles', () => {
  it('exibe métricas e informações de uso de limite', () => {
    render(
      <InstanceMetricsTiles
        surfaceStyles={surfaceStyles}
        metrics={{ sent: 15, queued: 5, failed: 2, status: { 1: 10, 2: 5 }, rateUsage: { used: 20, remaining: 30, limit: 50, percentage: 40 } }}
        statusValues={{ 1: 10, 2: 5 }}
        statusCodeMeta={statusCodeMeta}
        rateUsage={{ used: 20, remaining: 30, limit: 50, percentage: 40 }}
        ratePercentage={40}
      />
    );

    expect(screen.getByText('Enviadas')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Na fila')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Falhas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Utilização do limite/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
    expect(screen.getByText(/Usadas: 20/)).toBeInTheDocument();
    expect(screen.getByText(/Disponível: 30/)).toBeInTheDocument();
    expect(screen.getByText(/Limite: 50/)).toBeInTheDocument();
  });
});
