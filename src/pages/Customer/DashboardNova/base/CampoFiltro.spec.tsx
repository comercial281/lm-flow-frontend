import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Com `rotulo`, cada seletor vira um campo com o rótulo visível ligado à caixa.
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

// No computador a lista é o botão do design system, em modo bare. O lmf.css pinta
// a caixa pelo data-active e acende o ícone com `.lmf-campo-caixa:has(> [data-active])`:
// o botão tem que levar o data-active e ser filho direto da caixa.
describe('seletores com rótulo, no computador', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
    delete window.matchMedia;
  });

  it('Número de WhatsApp: botão filho direto da caixa, com data-active e uma seta só', async () => {
    render(<InstancePicker rotulo="Número de WhatsApp" value="2" onChange={vi.fn()} />);
    const caixa = await screen.findByRole('combobox', { name: 'Número de WhatsApp' });
    expect(caixa.tagName).toBe('BUTTON');
    expect(caixa).toHaveAttribute('data-active', 'true');
    expect(caixa).toHaveTextContent('Plantão');
    expect(caixa.parentElement).toHaveClass('lmf-campo-caixa');
    // A seta do design system some (bare); fica só a .lmf-campo-seta do campo.
    expect(caixa.className).toContain('[&>svg:last-child]:hidden');
    expect(caixa.parentElement!.querySelectorAll('.lmf-campo-seta')).toHaveLength(1);
  });
});
