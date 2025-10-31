/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import InstanceActionsMenu from '../InstanceActionsMenu.jsx';

describe('InstanceActionsMenu', () => {
  it('habilita ações para visualizar QR e remover instância', async () => {
    const onViewQr = vi.fn();
    const onRequestDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <InstanceActionsMenu
        instance={{ id: 'instance-1' }}
        deletingInstanceId={null}
        isBusy={false}
        isAuthenticated
        onViewQr={onViewQr}
        onRequestDelete={onRequestDelete}
      />
    );

    await user.click(screen.getByLabelText('Ações da instância'));
    await user.click(await screen.findByRole('menuitem', { name: /Ver QR Code/i }));
    expect(onViewQr).toHaveBeenCalledWith(expect.objectContaining({ id: 'instance-1' }));

    await user.click(screen.getByLabelText('Ações da instância'));
    await user.click(await screen.findByRole('menuitem', { name: /Remover instância/i }));
    expect(onRequestDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'instance-1' }));
  });

  it('desabilita ações quando instância está sendo removida', () => {
    render(
      <InstanceActionsMenu
        instance={{ id: 'instance-2' }}
        deletingInstanceId="instance-2"
        isBusy={false}
        isAuthenticated
      />
    );

    expect(screen.getByLabelText('Ações da instância')).toBeDisabled();
  });
});
