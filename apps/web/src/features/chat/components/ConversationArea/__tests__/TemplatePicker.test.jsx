/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplatePicker } from '../TemplatePicker.jsx';

const noop = () => {};

describe('TemplatePicker', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('explica que o modelo é inserido para revisão', () => {
    render(<TemplatePicker open onClose={noop} onSelect={noop} />);

    expect(screen.getByText('Modelos de mensagem')).toBeInTheDocument();
    expect(
      screen.getByText('Escolha um modelo para inserir na mensagem. Você revisa antes de enviar.')
    ).toBeInTheDocument();
  });

  it('preenche {{nome}} com o primeiro nome do cliente', async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker open onClose={noop} onSelect={onSelect} contactName="Maria Aparecida Souza" />);

    await userEvent.click(screen.getByRole('button', { name: /Boas-vindas/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [template] = onSelect.mock.calls[0];
    expect(template.body).toContain('Olá Maria,');
    expect(template.body).not.toContain('{{nome}}');
  });

  it('não emite avisos no console quando é aberto', () => {
    render(<TemplatePicker open onClose={noop} onSelect={noop} />);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
