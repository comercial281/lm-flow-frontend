import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: mocks.list, create: mocks.create, update: vi.fn(), remove: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TemplateVariables from './TemplateVariables';

describe('Janela de variável', () => {
  it('tem os grupos do miolo, sem código técnico', async () => {
    mocks.list.mockResolvedValue({ builtin: [], custom: [] });
    render(<MemoryRouter><TemplateVariables /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: /Nova variável/ }));
    const dialogo = await screen.findByRole('dialog');
    for (const nome of ['Identificação', 'De onde vem o valor', 'Estado']) {
      expect(within(dialogo).getByRole('group', { name: nome })).toBeInTheDocument();
    }
    expect(within(dialogo).getByLabelText('Origem do valor')).toBeInTheDocument();
    expect(dialogo.textContent).not.toMatch(/custom_attributes|phone_number/);
  });
});
