// src/features/dashboard/links.spec.ts
import { describe, it, expect } from 'vitest';
import {
  linkImoveis, lerRecorteImoveis, linkAgenda, lerFiltroAgenda,
  linkPropostas, lerFiltroPropostas, linkFunil, linkCard, linkConversa, linkAceite,
} from './links';

const sp = (url: string) => new URLSearchParams(url.split('?')[1] ?? '');

describe('links da Dashboard', () => {
  it('Imóveis: o link e a leitura dão os mesmos filtros', () => {
    const url = linkImoveis('sem_fotos');
    expect(url).toBe('/properties?recorte=sem_fotos');
    expect(lerRecorteImoveis(sp(url))).toEqual({
      rotulo: 'Sem fotos',
      params: { status: 'active', without_photos: '1' },
    });
  });

  it('Imóveis: "novos" leva a data de início, e "meus" recorta na pessoa', () => {
    const url = linkImoveis('novos', { desde: '2026-09-24', meus: true });
    expect(lerRecorteImoveis(sp(url))).toEqual({
      rotulo: 'Novos (seus)',
      params: { created_since: '2026-09-24', mine: '1' },
    });
  });

  it('Imóveis: "novos" com início e fim leva os dois para o servidor', () => {
    const url = linkImoveis('novos', { desde: '2026-08-01', ate: '2026-08-31' });
    expect(url).toBe('/properties?recorte=novos&desde=2026-08-01&ate=2026-08-31');
    expect(lerRecorteImoveis(sp(url))).toEqual({
      rotulo: 'Novos',
      params: { created_since: '2026-08-01', created_until: '2026-08-31' },
    });
  });

  it('Imóveis: o fim só vale no recorte "novos"', () => {
    expect(linkImoveis('sem_fotos', { ate: '2026-08-31' })).toBe('/properties?recorte=sem_fotos');
    expect(lerRecorteImoveis(sp('/properties?recorte=sem_fotos&ate=2026-08-31'))?.params)
      .toEqual({ status: 'active', without_photos: '1' });
  });

  it('Imóveis: recorte desconhecido ou data torta são ignorados', () => {
    expect(lerRecorteImoveis(sp('/properties?recorte=qualquer'))).toBeNull();
    expect(lerRecorteImoveis(sp('/properties?recorte=novos&desde=ontem'))).toEqual({ rotulo: 'Novos', params: {} });
  });

  it('Agenda: situação e período viram os filtros do servidor, com um rótulo legível', () => {
    const url = linkAgenda({ situacao: 'a_confirmar', desde: '2026-09-24', ate: '2026-09-30' });
    const f = lerFiltroAgenda(sp(url));
    expect(f?.params).toEqual({ pending_confirmation: '1', since: '2026-09-24', until: '2026-09-30' });
    expect(f?.rotulo).toBe('A confirmar · 24/09 a 30/09');
    expect(f?.visita).toBeNull();
  });

  it('Agenda: abrir uma visita só pelo link', () => {
    const f = lerFiltroAgenda(sp(linkAgenda({ visita: 'v1' })));
    expect(f).toEqual({ rotulo: '', params: {}, visita: 'v1' });
  });

  it('Agenda: sem nada no link, sem filtro', () => {
    expect(lerFiltroAgenda(new URLSearchParams())).toBeNull();
  });

  it('Propostas: só o período', () => {
    const f = lerFiltroPropostas(sp(linkPropostas({ desde: '2026-09-24' })));
    expect(f).toEqual({ rotulo: 'desde 24/09', params: { since: '2026-09-24' } });
  });

  it('funil, card, conversa e aceite', () => {
    expect(linkFunil('p1', 'e1')).toBe('/pipelines/p1?etapa=e1');
    expect(linkFunil('p1')).toBe('/pipelines/p1');
    expect(linkCard('p1', 'i1')).toBe('/pipelines/p1?card=i1');
    expect(linkConversa('c1')).toBe('/conversations/c1');
    expect(linkAceite('o1')).toBe('/roleta/aceite/o1');
  });
});
