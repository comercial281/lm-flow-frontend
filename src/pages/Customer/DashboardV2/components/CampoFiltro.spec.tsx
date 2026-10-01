import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/store/appDataStore', () => ({ mayRead: vi.fn().mockResolvedValue(true) }));
vi.mock('@/services/channels/inboxesService', () => ({
  default: { list: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Loja' }, { id: 2, name: 'Plantão' }] }) },
}));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [{ id: 1, title: 'quente', color: '#f00' }] }) },
}));
let agentes: { id: string; name: string; enabled: boolean }[] = [];
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list: vi.fn(() => Promise.resolve(agentes)) } }));

import { InstancePicker } from './InstancePicker';
import { TagPicker } from './TagPicker';
import { AiToggle } from './AiToggle';

// Com `rotulo` (Dashboard nova), cada seletor vira um campo com o rótulo visível
// ligado à caixa. Sem `rotulo`, o desenho da DashboardV2 não muda.
describe('seletores com rótulo', () => {
  it('Número de WhatsApp e Etiqueta: rótulo visível que dá nome à caixa', async () => {
    const onNumero = vi.fn();
    render(<>
      <InstancePicker rotulo="Número de WhatsApp" value="2" onChange={onNumero} />
      <TagPicker rotulo="Etiqueta" onChange={vi.fn()} />
    </>);
    const numero = await screen.findByRole('combobox', { name: 'Número de WhatsApp' });
    expect(numero).toHaveValue('2');
    expect(numero).toHaveAttribute('data-active', 'true');
    fireEvent.change(numero, { target: { value: '1' } });
    expect(onNumero).toHaveBeenCalledWith('1', 'Loja');
    expect(await screen.findByRole('combobox', { name: 'Etiqueta' })).toHaveValue('');
  });

  it('Atendimento com uma IA só: botão "Só IA" dentro do grupo Atendimento', async () => {
    agentes = [];
    const onChange = vi.fn();
    render(<AiToggle rotulo="Atendimento" active={false} onChange={onChange} />);
    const grupo = screen.getByRole('group', { name: 'Atendimento' });
    const botao = screen.getByRole('button', { name: 'Só IA' });
    expect(grupo).toContainElement(botao);
    fireEvent.click(botao);
    expect(onChange).toHaveBeenCalledWith({ active: true, salesAgentId: undefined });
  });

  it('Atendimento com duas IAs: lista com o rótulo Atendimento', async () => {
    agentes = [{ id: 'a', name: 'Sara', enabled: true }, { id: 'b', name: 'Bia', enabled: true }];
    render(<AiToggle rotulo="Atendimento" active={false} onChange={vi.fn()} />);
    expect(await screen.findByRole('combobox', { name: 'Atendimento' })).toHaveValue('');
  });
});
