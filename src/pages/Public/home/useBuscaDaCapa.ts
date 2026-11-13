import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalProperty, SiteInfo } from '../portalShared';
import { opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { CAMPOS_BUSCA, TITULO_CAPA_FABRICA, type AbaId, type CampoBusca, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { faixasDePreco, precoDaFaixa } from '@/features/siteBuilder/public/faixasDePreco';
import { FASES_DO_PUBLICO } from '@/features/properties/listingKind';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   O que as capas da página inicial (Clássico e Moderno) dividem: a busca
   rápida (aba, campos de `home.search.fields` e a ida para `/imoveis` com os
   filtros na URL) e os textos e a foto de reserva. Cada capa só desenha.
──────────────────────────────────────────────────────────────────────────── */

export const ROTULO_ABA: Record<AbaId, string> = { sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos' };
const SUBTITULO_PADRAO = 'Apartamentos, casas e lançamentos com curadoria, fotos reais e atendimento humano de verdade.';
const CAPA_PADRAO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80';
const ATE_4: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']];
const ATE_3: [string, string][] = [['1', '1+'], ['2', '2+'], ['3', '3+']];

export type CampoDeEscolha = Exclude<CampoBusca, 'code'>;

export interface PropsDaBusca {
  home: HomeConfig;
  tenant: string;
  abas: AbaId[];
  cities: string[];
  hoods: string[];
  types: string[];
  /** Avisado quando a pessoa troca de aba (a captura de contato acompanha). */
  onTab?: (tab: AbaId) => void;
}

/** Título e subtítulo da capa, com os de fábrica quando o cliente não escreveu. */
export function textosDaCapa(site: SiteInfo, home: HomeConfig) {
  return {
    titulo: home.search.title?.trim() || TITULO_CAPA_FABRICA,
    subtitulo: home.search.subtitle?.trim() || site.seo?.description || SUBTITULO_PADRAO,
  };
}

/** Foto escolhida no Site Builder (de um imóvel ou enviada); sem ela, a capa do primeiro imóvel. */
export function fotoDaCapa(site: SiteInfo, items: PortalProperty[]): string {
  return site.hero?.image_url || items[0]?.cover_url || CAPA_PADRAO;
}

export function useBuscaDaCapa({ home, tenant, abas, cities, hoods, types, onTab }: PropsDaBusca) {
  const navigate = useNavigate();
  const ctx = useCtxDoSite(tenant);
  // Sem aba visível (catálogo vazio ou todas desligadas), a busca cai em Comprar.
  const [tab, setTab] = useState<AbaId>(abas[0] ?? 'sale');
  const [valores, setValores] = useState<Partial<Record<CampoBusca, string>>>({});
  const set = (k: CampoBusca) => (v: string) => setValores(s => ({ ...s, [k]: v }));

  // Fase é de empreendimento, e Alugar não tem empreendimento: o campo some nessa aba.
  const campos = CAMPOS_BUSCA.filter(c => home.search.fields.includes(c) && !(c === 'stage' && tab === 'rent'));
  const selects = campos.filter((c): c is CampoDeEscolha => c !== 'code');
  const temCodigo = campos.includes('code');

  const trocarAba = (k: AbaId) => {
    // As faixas de preço do aluguel são outras: a faixa marcada não vale mais.
    if (faixasDePreco(k) !== faixasDePreco(tab)) setValores(s => ({ ...s, price: '' }));
    if (k === 'rent') setValores(s => ({ ...s, stage: '' }));
    setTab(k);
    onTab?.(k);
  };

  /**
   * Vai pra `/imoveis` com a aba e os campos de hoje. `extra` (a busca por
   * texto da capa do Moderno: bairro, cidade ou código) vale por cima dos
   * campos, mesmo de um campo que o site não mostra. Sem `extra`, é a busca
   * de sempre (a do Clássico).
   */
  const irParaBusca = (extra: Partial<Record<'city' | 'neighborhood' | 'code', string>> = {}) => {
    const params = new URLSearchParams();
    if (tab !== 'sale') params.set('tab', tab);
    // Na ordem dos campos de sempre: o endereço sai igual ao do Clássico com os mesmos valores.
    const juntos: Partial<Record<CampoBusca, string>> = { ...valores, ...extra };
    for (const c of CAMPOS_BUSCA.filter(k => campos.includes(k) || extra[k as keyof typeof extra])) {
      const v = juntos[c];
      if (!v) continue;
      if (c === 'price') {
        for (const [k, n] of Object.entries(precoDaFaixa(tab, v))) params.set(k, n);
      } else {
        params.set(c, v);
      }
    }
    const qs = params.toString();
    navigate(caminhoDoSite(ctx, `/imoveis${qs ? `?${qs}` : ''}`));
  };

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    irParaBusca();
  };

  const opcoes: Record<CampoDeEscolha, { label: string; options: [string, string][] }> = {
    type: { label: 'Tipo', options: opcoesDeTipo(types) },
    city: { label: 'Cidade', options: cities.map(c => [c, c]) },
    neighborhood: { label: 'Bairro', options: hoods.map(h => [h, h]) },
    price: { label: 'Faixa de preço', options: faixasDePreco(tab).map(f => [f.valor, f.rotulo]) },
    bedrooms: { label: 'Dormitórios', options: ATE_4 },
    suites: { label: 'Suítes', options: ATE_3 },
    parking: { label: 'Vagas', options: ATE_3 },
    stage: { label: 'Fase', options: FASES_DO_PUBLICO.map(f => [f.valor, f.rotulo]) },
  };

  return { tab, trocarAba, valores, set, selects, temCodigo, runSearch, irParaBusca, opcoes, cities, hoods };
}

/** O que a busca da capa entrega pra quem desenha o formulário. */
export type BuscaDaCapa = ReturnType<typeof useBuscaDaCapa>;
