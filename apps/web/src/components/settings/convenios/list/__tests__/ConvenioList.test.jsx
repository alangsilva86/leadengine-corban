import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConvenioList from '../ConvenioList.jsx';

const sampleConvenios = [
  {
    id: '1',
    nome: 'Convênio Municipal',
    averbadora: 'Org 1',
    status: 'ATIVO',
    produtos: ['Consignado tradicional'],
    responsavel: 'Ana',
    archived: false,
  },
  {
    id: '2',
    nome: 'Convênio Estadual',
    averbadora: 'Org 2',
    status: 'EM_IMPLANTACAO',
    produtos: [],
    responsavel: 'Bruno',
    archived: true,
  },
];

describe('ConvenioList', () => {
  it('dispara onSelect ao clicar em uma linha', () => {
    const handleSelect = vi.fn();
    render(
      <ConvenioList
        convenios={sampleConvenios}
        selectedId={null}
        onSelect={handleSelect}
        onArchive={vi.fn()}
        readOnly={false}
        onCreate={vi.fn()}
        onOpenImport={vi.fn()}
        onRefresh={vi.fn()}
        isLoading={false}
        isFetching={false}
      />
    );

    const row = screen.getByText('Convênio Municipal').closest('tr');
    fireEvent.click(row);

    expect(handleSelect).toHaveBeenCalledWith('1');
  });

  it('desabilita criação e importação quando readOnly', () => {
    render(
      <ConvenioList
        convenios={sampleConvenios}
        selectedId="1"
        onSelect={vi.fn()}
        onArchive={vi.fn()}
        readOnly
        onCreate={vi.fn()}
        onOpenImport={vi.fn()}
        onRefresh={vi.fn()}
        isLoading={false}
        isFetching={false}
      />
    );

    expect(screen.getByRole('button', { name: /novo convênio/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /importar planilha/i })).toBeDisabled();
  });
});
