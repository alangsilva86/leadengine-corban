import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CalendarCard from '../CalendarCard.jsx';
import WindowDialog from '../WindowDialog.jsx';

const mockWindow = {
  id: 'window-1',
  label: 'Janela 1',
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31'),
  firstDueDate: new Date('2024-03-01'),
};

describe('CalendarCard', () => {
  it('exibe alerta quando não há janela ativa', () => {
    render(<CalendarCard windows={[]} onUpsert={vi.fn()} onRemove={vi.fn()} readOnly={false} />);
    expect(screen.getByText(/sem janela ativa/i)).toBeInTheDocument();
  });
});

describe('WindowDialog', () => {
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    globalThis.crypto = { randomUUID: () => 'generated-id' };
  });

  afterAll(() => {
    globalThis.crypto = originalCrypto;
  });

  it('valida datas e envia janela sem sobreposição', () => {
    const handleSubmit = vi.fn();
    render(
      <WindowDialog
        open
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        initialValue={null}
        windows={[mockWindow]}
        disabled={false}
      />
    );

    fireEvent.change(screen.getByLabelText('1º dia'), { target: { value: '2024-02-01' } });
    fireEvent.change(screen.getByLabelText('Último dia'), { target: { value: '2024-02-20' } });
    fireEvent.change(screen.getByLabelText('1º vencimento'), { target: { value: '2024-03-05' } });
    fireEvent.submit(screen.getByRole('button', { name: /salvar janela/i }));

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Janela', id: 'generated-id' })
    );
  });
});
