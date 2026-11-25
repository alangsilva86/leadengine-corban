/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import QrPreview from '../QrPreview';

afterEach(() => {
  cleanup();
});

describe('QrPreview', () => {
  it('mostra o QR com tamanho legível e a contagem até a próxima atualização', () => {
    render(<QrPreview phase="ready" src="data:image/png;base64,AAAA" secondsLeft={18} />);

    const image = screen.getByAltText('QR Code para conectar o WhatsApp');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(image).toHaveAttribute('width', '264');
    expect(screen.getByText('Atualiza em 18s')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar novo QR/i })).not.toBeInTheDocument();
  });

  it('exibe o carregamento enquanto o QR é gerado', () => {
    render(<QrPreview phase="loading" />);
    expect(screen.getByText('Gerando QR Code…')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('pausa a renovação e permite gerar um novo QR', async () => {
    const onRegenerate = vi.fn();
    const user = userEvent.setup();
    render(<QrPreview phase="paused" onRegenerate={onRegenerate} />);

    expect(screen.getByText('QR pausado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Gerar novo QR/i }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('explica o erro e oferece nova tentativa', () => {
    render(<QrPreview phase="error" errorMessage="O serviço está instável." onRegenerate={vi.fn()} />);
    expect(screen.getByText('Não foi possível gerar o QR Code')).toBeInTheDocument();
    expect(screen.getByText('O serviço está instável.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar novo QR/i })).toBeInTheDocument();
  });
});
