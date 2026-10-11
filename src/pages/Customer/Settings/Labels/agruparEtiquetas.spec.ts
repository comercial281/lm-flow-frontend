import { describe, it, expect } from 'vitest';
import { agruparEtiquetas } from './agruparEtiquetas';
import type { Label } from '@/types/settings';

const l = (title: string, category: Label['category'], display_name = title): Label =>
  ({ id: title, title, category, display_name, color: '#ef4444', show_on_sidebar: true, created_at: '', updated_at: '' });

const todas = [
  l('cliente vip', 'own', 'Cliente vip'),
  l('im0001', 'property', 'IM0001'),
  l('follow-up-pausado', 'followup', 'Follow-up pausado'),
  l('visita-agendada', 'service', 'Visita agendada'),
  l('lead-morno', 'sales_agent', 'Lead morno'),
  l('sem-categoria', undefined, 'Sem categoria'),
];

describe('agruparEtiquetas', () => {
  it('separa suas das do sistema, na ordem das caixas', () => {
    const g = agruparEtiquetas(todas, '');
    expect(g.suas.map(x => x.title)).toEqual(['cliente vip', 'sem-categoria']);
    expect(g.sistema.map(c => c.id)).toEqual(['service', 'followup', 'property', 'sales_agent']);
  });

  it('caixa vazia some', () => {
    expect(agruparEtiquetas(todas, '').sistema.find(c => c.id === 'deal_type')).toBeUndefined();
  });

  it('busca acha pelo nome legível e pelo título real', () => {
    expect(agruparEtiquetas(todas, 'pausado').sistema.map(c => c.id)).toEqual(['followup']);
    expect(agruparEtiquetas(todas, 'im0001').sistema.map(c => c.id)).toEqual(['property']);
    expect(agruparEtiquetas(todas, 'VIP').suas.map(x => x.title)).toEqual(['cliente vip']);
  });

  it('busca ignora acento', () => {
    const g = agruparEtiquetas([l('locação', 'deal_type', 'Locação')], 'locacao');
    expect(g.sistema[0].itens).toHaveLength(1);
  });
});
