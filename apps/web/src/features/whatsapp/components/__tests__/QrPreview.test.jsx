/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { passthrough } = vi.hoisted(() => {
  const factory = (Tag = 'div') => {
    const Component = ({ children, ...props }) => <Tag {...props}>{children}</Tag>;
    return Component;
  };

  return { passthrough: factory };
});

vi.mock('@/components/ui/button.jsx', () => ({ Button: passthrough('button') }));
vi.mock('lucide-react', () => ({
  Clock: (props) => <svg data-testid="clock-icon" {...props} />, 
  Loader2: (props) => <svg data-testid="loader-icon" {...props} />, 
  QrCode: (props) => <svg data-testid="qr-icon" {...props} />, 
  RefreshCcw: (props) => <svg data-testid="refresh-icon" {...props} />,
}));
vi.mock(
  'prop-types',
  () => ({
    __esModule: true,
    default: new Proxy(
      {},
      {
        get: () => () => null,
      }
    ),
  }),
  { virtual: true }
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

let QrPreview;

beforeAll(async () => {
  ({ default: QrPreview } = await import('../QrPreview.jsx'));
});

describe('QrPreview', () => {
  it('renderiza a imagem quando o QR está disponível e dispara ações', async () => {
    const onGenerate = vi.fn();
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <QrPreview
        src="data:image/png;base64,AAAA"
        statusMessage="QR válido por 1 minuto"
        onGenerate={onGenerate}
        onOpen={onOpen}
      />
    );

    const qrImage = screen.getByAltText('QR Code do WhatsApp');
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,AAAA');

    expect(screen.getByText('QR válido por 1 minuto')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Gerar novo QR/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Abrir em tela cheia/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('exibe placeholder ou loader quando o QR ainda não foi carregado', () => {
    const { rerender, container } = render(<QrPreview />);
    expect(container.querySelector('[data-testid="qr-icon"]')).toBeInTheDocument();
    expect(screen.queryByAltText('QR Code do WhatsApp')).not.toBeInTheDocument();

    rerender(<QrPreview isGenerating />);
    expect(container.querySelector('[data-testid="loader-icon"]')).toBeInTheDocument();
  });

  it('respeita estados desabilitados dos botões e mantém acessibilidade do status', async () => {
    const onGenerate = vi.fn();
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <QrPreview
        statusMessage="Gerando novo código"
        onGenerate={onGenerate}
        onOpen={onOpen}
        generateDisabled
        openDisabled
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Gerando novo código');

    const regenerateButton = screen.getByRole('button', { name: /Gerar novo QR/i });
    const openButton = screen.getByRole('button', { name: /Abrir em tela cheia/i });

    expect(regenerateButton).toBeDisabled();
    expect(openButton).toBeDisabled();

    await user.click(regenerateButton);
    await user.click(openButton);

    expect(onGenerate).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
