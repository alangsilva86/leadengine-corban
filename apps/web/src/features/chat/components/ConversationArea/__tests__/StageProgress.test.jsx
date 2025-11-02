/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import StageProgress from '../StageProgress.jsx';

describe('StageProgress', () => {
  it('highlights the current stage and lists the upcoming steps', () => {
    render(<StageProgress currentStage="Proposta" />);

    const currentStage = screen.getByLabelText('Etapa atual: Proposta');
    expect(currentStage).toHaveAttribute('aria-current', 'step');

    expect(screen.getByLabelText('Próxima etapa: Documentação')).toBeInTheDocument();
    expect(screen.getByLabelText('Próxima etapa: Documentos/Averbação')).toBeInTheDocument();
  });

  it('falls back to an accessible label when the stage is not part of the funnel', () => {
    render(<StageProgress currentStage="Nova etapa misteriosa" />);

    expect(screen.getByLabelText('Etapa atual: Nova Etapa Misteriosa')).toBeInTheDocument();
  });

  it('does not render when the stage is unknown', () => {
    const { container } = render(<StageProgress currentStage={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('matches the snapshot for a mid-funnel stage', () => {
    const { asFragment } = render(<StageProgress currentStage="Proposta" />);

    expect(asFragment()).toMatchSnapshot();
  });
});
