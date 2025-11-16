import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BasicInformation from '../BasicInformation.jsx';

describe('BasicInformation', () => {
  it('envia dados básicos com campos preenchidos', () => {
    const handleSave = vi.fn();
    render(
      <BasicInformation
        initialValues={{
          nome: 'Convênio X',
          averbadora: 'Org X',
          tipo: 'MUNICIPAL',
          status: 'ATIVO',
          produtos: [],
          responsavel: 'Ana',
        }}
        onSave={handleSave}
        disabled={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/nome do convênio/i), { target: { value: ' Novo ' } });
    fireEvent.submit(screen.getByRole('button', { name: /salvar dados básicos/i }));

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Novo', averbadora: 'Org X', status: 'ATIVO' })
    );
  });

  it('não dispara onSave quando está desabilitado', () => {
    const handleSave = vi.fn();
    render(
      <BasicInformation
        initialValues={{ nome: '', averbadora: '', tipo: 'MUNICIPAL', status: 'EM_IMPLANTACAO', produtos: [], responsavel: '' }}
        onSave={handleSave}
        disabled
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /salvar dados básicos/i }));
    expect(handleSave).not.toHaveBeenCalled();
  });
});
