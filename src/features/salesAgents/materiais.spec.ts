import { describe, expect, it } from 'vitest';
import type { SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { materiaisDaCasa, materiaisPorImovel, pinoPode, porQueOPinoNaoSai, QUANDO_PADRAO, type ImovelDaPagina } from './materiais';

const doc = (id: string, extra: Partial<SalesAgentDocument> = {}) =>
  ({ id, title: `Material ${id}`, sendable: true, property_codes: [], ...extra }) as SalesAgentDocument;

const empreendimento = (extra: Partial<ImovelDaPagina> = {}): ImovelDaPagina => ({
  code: 'AB01', title: 'Residencial Teste', listing_kind: 'development',
  latitude: -23.5, longitude: -46.6, address_neighborhood: 'Bairro Teste', address_city: 'Cidade Teste', ...extra,
});

describe('materiaisDaCasa', () => {
  it('é o enviável sem imóvel ligado', () => {
    const docs = [doc('a'), doc('b', { property_codes: ['AB01'] }), doc('c', { sendable: false }), doc('d', { property_codes: undefined as unknown as string[] })];
    expect(materiaisDaCasa(docs).map((d) => d.id)).toEqual(['a', 'd']);
  });
});

describe('materiaisPorImovel', () => {
  it('material ligado a dois imóveis aparece nos dois; imóvel sem material fica com lista vazia', () => {
    const docs = [doc('a', { property_codes: ['AB01', 'AB02'] }), doc('b', { property_codes: ['AB03'] }), doc('c'), doc('d', { property_codes: ['AB01'], sendable: false })];
    const por = materiaisPorImovel(docs, [{ code: 'AB01' }, { code: 'AB02' }, { code: 'AB04' }]);
    expect(por.AB01.map((d) => d.id)).toEqual(['a']);
    expect(por.AB02.map((d) => d.id)).toEqual(['a']);
    expect(por.AB04).toEqual([]);
    expect(por.AB03).toBeUndefined();
  });
});

describe('pinoPode (regra de 03/10)', () => {
  const agente = agenteDeTeste({ ai_limits: {} });
  it('só empreendimento', () => {
    expect(pinoPode(empreendimento(), agente)).toBe(true);
    expect(pinoPode(empreendimento({ listing_kind: 'resale' }), agente)).toBe(false);
    expect(pinoPode(empreendimento({ listing_kind: 'auction' }), agente)).toBe(false);
    expect(pinoPode(empreendimento({ listing_kind: undefined }), agente)).toBe(false);
  });
  it('nunca com a restrição "endereço exato" ligada', () => {
    expect(pinoPode(empreendimento(), agenteDeTeste({ ai_limits: { address: true } }))).toBe(false);
  });
  it('precisa de coordenada e de bairro ou cidade', () => {
    expect(pinoPode(empreendimento({ latitude: null }), agente)).toBe(false);
    expect(pinoPode(empreendimento({ longitude: null }), agente)).toBe(false);
    expect(pinoPode(empreendimento({ address_neighborhood: '' }), agente)).toBe(true);
    expect(pinoPode(empreendimento({ address_neighborhood: '', address_city: '' }), agente)).toBe(false);
  });
  it('a chave do pino não entra: "Fotos e vídeo" desligado não tira o pino', () => {
    expect(pinoPode(empreendimento(), agenteDeTeste({ ai_limits: {}, rich_media_enabled: false }))).toBe(true);
  });
});

describe('porQueOPinoNaoSai', () => {
  const agente = agenteDeTeste({ ai_limits: {} });
  it('null quando sai', () => expect(porQueOPinoNaoSai(empreendimento(), agente)).toBeNull());
  it('explica cada caso, sem travessão', () => {
    const textos = [
      porQueOPinoNaoSai(empreendimento({ listing_kind: 'resale' }), agente),
      porQueOPinoNaoSai(empreendimento(), agenteDeTeste({ ai_limits: { address: true } })),
      porQueOPinoNaoSai(empreendimento({ latitude: null }), agente),
      porQueOPinoNaoSai(empreendimento({ address_neighborhood: '', address_city: '' }), agente),
    ];
    textos.forEach((t) => { expect(t).toBeTruthy(); expect(t).not.toMatch(/[—–]/); });
    expect(textos[0]).toMatch(/revenda/i);
    expect(textos[1]).toMatch(/Endereço exato/);
    expect(new Set(textos).size).toBe(4);
  });
});

describe('QUANDO_PADRAO', () => {
  it('tem fotos e vídeo, pino e tour', () => {
    expect(Object.keys(QUANDO_PADRAO).sort()).toEqual(['fotos', 'pino', 'tour']);
    Object.values(QUANDO_PADRAO).forEach((t) => expect(t).not.toMatch(/[—–]/));
  });
});
