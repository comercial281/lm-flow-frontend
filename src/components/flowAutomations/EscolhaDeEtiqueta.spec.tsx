import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ createLabel: vi.fn(), error: vi.fn() }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { createLabel: mocks.createLabel } }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));

import { EscolhaDeEtiqueta } from './EscolhaDeEtiqueta';
import type { Label } from '@/types/settings/labels';

const et = (title: string, extra: Partial<Label> = {}): Label =>
  ({ id: title, title, color: '#2563eb', show_on_sidebar: true, created_at: '', updated_at: '', category: 'own', contacts_count: 0, ...extra });

const etiquetas: Label[] = [
  et('zeta', { display_name: 'Zeta', contacts_count: 3 }),
  et('alfa', { display_name: 'Alfa', contacts_count: 38 }),
  et('beta', { display_name: 'Beta', contacts_count: 1 }),
  et('im0001', { display_name: 'IM0001', category: 'property', contacts_count: 2 }),
  et('im0002', { display_name: 'IM0002', category: 'property', contacts_count: 5 }),
];

const base = { modo: 'varias' as const, escolhidas: [] as string[], aoMudar: vi.fn(), etiquetas };

beforeEach(() => {
  mocks.createLabel.mockReset();
  base.aoMudar = vi.fn();
});

describe('EscolhaDeEtiqueta', () => {
  it('mostra o nome bonito e grava o título', () => {
    render(<EscolhaDeEtiqueta {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /Do sistema/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /IM0001/ }));
    expect(base.aoMudar).toHaveBeenCalledWith(['im0001']);
  });

  it('etiquetas do sistema ficam no grupo Do sistema, recolhido', () => {
    render(<EscolhaDeEtiqueta {...base} />);
    const grupo = screen.getByRole('button', { name: /Do sistema/ });
    expect(grupo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('IM0001')).toBeNull();
    expect(screen.getByText('Da equipe')).toBeTruthy();
    fireEvent.click(grupo);
    expect(screen.getByText('IM0001')).toBeTruthy();
  });

  it('marcadas sobem pro topo com a contagem "2 marcadas"', () => {
    render(<EscolhaDeEtiqueta {...base} escolhidas={['zeta', 'beta']} />);
    expect(screen.getByText('2 marcadas')).toBeTruthy();
    expect(screen.getByText('Marcadas')).toBeTruthy();
    const nomes = screen.getAllByRole('checkbox').map(c => c.textContent);
    expect(nomes[0]).toContain('Zeta');
    expect(nomes[1]).toContain('Beta');
    expect(nomes[2]).toContain('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(base.aoMudar).toHaveBeenCalledWith([]);
  });

  it('busca sem resultado oferece Criar etiqueta “Quente” e chama createLabel com o título e uma cor', async () => {
    mocks.createLabel.mockResolvedValue({ data: { id: 'q', title: 'Quente', color: '#000' } });
    const aoCriar = vi.fn().mockResolvedValue(undefined);
    render(<EscolhaDeEtiqueta {...base} aoCriar={aoCriar} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar etiqueta'), { target: { value: 'Quente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta “Quente”' }));
    await waitFor(() => expect(base.aoMudar).toHaveBeenCalledWith(['Quente']));
    expect(mocks.createLabel).toHaveBeenCalledWith(expect.objectContaining({ title: 'Quente', color: expect.stringMatching(/^#/) }));
    expect(aoCriar).toHaveBeenCalledWith('Quente');
  });

  it('título gravado que não existe mais aparece como "não existe mais"', () => {
    render(<EscolhaDeEtiqueta {...base} escolhidas={['sumiu']} />);
    expect(screen.getByText('sumiu')).toBeTruthy();
    expect(screen.getByText('não existe mais')).toBeTruthy();
  });

  it('modo uma troca a escolha em vez de somar', () => {
    render(<EscolhaDeEtiqueta {...base} modo="uma" escolhidas={['alfa']} />);
    expect(screen.getByText('1 marcada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Beta/ }));
    expect(base.aoMudar).toHaveBeenCalledWith(['beta']);
  });

  it('Tirar etiqueta ordena pelas com mais leads', () => {
    render(<EscolhaDeEtiqueta {...base} ordem="mais_leads" />);
    const nomes = screen.getAllByRole('checkbox').map(c => c.textContent ?? '');
    expect(nomes[0]).toContain('Alfa');
    expect(nomes[0]).toContain('38 leads');
    expect(nomes[1]).toContain('Zeta');
    expect(nomes[2]).toContain('1 lead');
  });

  it('conta grande sem busca mostra só as 30 com mais leads e o aviso', () => {
    const muitas = Array.from({ length: 210 }, (_, i) => et(`e${i}`, { display_name: `E${i}`, contacts_count: i }));
    render(<EscolhaDeEtiqueta {...base} etiquetas={muitas} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(30);
    expect(screen.getByText('Em conta grande, as outras aparecem quando você digita.')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar etiqueta'), { target: { value: 'e1' } });
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(30);
  });

  it('createLabel falha: avisa e não muda a escolha', async () => {
    mocks.createLabel.mockRejectedValue(new Error('x'));
    render(<EscolhaDeEtiqueta {...base} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar etiqueta'), { target: { value: 'Quente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta “Quente”' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(base.aoMudar).not.toHaveBeenCalled();
  });

  it('nome saneado igual a um título existente só seleciona, sem criar', () => {
    render(<EscolhaDeEtiqueta {...base} etiquetas={[et('quente', { category: 'property' })]} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar etiqueta'), { target: { value: 'Quente.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta “Quente”' }));
    expect(mocks.createLabel).not.toHaveBeenCalled();
    expect(base.aoMudar).toHaveBeenCalledWith(['quente']);
  });

  it('Enter marca a primeira da busca', () => {
    render(<EscolhaDeEtiqueta {...base} />);
    const campo = screen.getByPlaceholderText('Buscar ou criar etiqueta');
    fireEvent.change(campo, { target: { value: 'a' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(base.aoMudar).toHaveBeenCalledWith(['alfa']);
  });

  it('modo uma chama o campo de Etiqueta, no singular', () => {
    render(<EscolhaDeEtiqueta {...base} modo="uma" />);
    expect(screen.getByText('Etiqueta')).toBeTruthy();
  });

  describe('sem criar (Disparo)', () => {
    it('busca sem resultado avisa e Enter não cria', () => {
      render(<EscolhaDeEtiqueta {...base} semCriar />);
      const campo = screen.getByPlaceholderText('Buscar etiqueta');
      fireEvent.change(campo, { target: { value: 'nadaaver' } });
      expect(screen.getByText('Nenhuma etiqueta com esse nome.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Criar etiqueta/ })).toBeNull();
      fireEvent.keyDown(campo, { key: 'Enter' });
      expect(mocks.createLabel).not.toHaveBeenCalled();
      expect(base.aoMudar).not.toHaveBeenCalled();
    });

    it('conta sem etiqueta mostra "Nenhuma etiqueta cadastrada ainda."', () => {
      render(<EscolhaDeEtiqueta {...base} etiquetas={[]} semCriar />);
      expect(screen.getByText('Nenhuma etiqueta cadastrada ainda.')).toBeTruthy();
      expect(screen.queryByText(/Digite um nome pra criar/)).toBeNull();
    });
  });

  it('etiqueta sem contagem não mostra número (nem "0 leads")', () => {
    render(<EscolhaDeEtiqueta {...base} etiquetas={[et('sem-numero', { contacts_count: undefined })]} />);
    expect(screen.getByRole('checkbox', { name: /sem-numero/ })).toBeTruthy();
    expect(screen.queryByText(/leads?$/)).toBeNull();
  });

  it('semNome não repete o rótulo e usa o idBusca', () => {
    render(<EscolhaDeEtiqueta {...base} semNome idBusca="busca-do-disparo" />);
    expect(screen.queryByText('Etiquetas')).toBeNull();
    expect(screen.getByText('Nenhuma marcada')).toBeTruthy();
    expect(screen.getByRole('textbox').id).toBe('busca-do-disparo');
  });
});
