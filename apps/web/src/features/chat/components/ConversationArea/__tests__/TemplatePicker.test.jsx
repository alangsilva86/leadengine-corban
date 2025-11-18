import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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

  it('exibe a descrição explicativa logo abaixo do título', () => {
    render(<TemplatePicker open onClose={noop} onSelect={noop} />);

    expect(screen.getByText('Selecionar template aprovado')).toBeInTheDocument();
    expect(
      screen.getByText('Escolha um template aprovado para inserir no chat.')
    ).toBeInTheDocument();
  });

  it('não emite avisos no console quando é aberto', () => {
    render(<TemplatePicker open onClose={noop} onSelect={noop} />);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
