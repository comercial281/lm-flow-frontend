import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalProperty, SiteInfo } from '../portalShared';
import { opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { CAMPOS_BUSCA, TITULO_CAPA_FABRICA, type AbaId, type CampoBusca, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { AREAS_MINIMAS } from '@/features/siteBuilder/public/filtros';
import type { SugestaoDeLugar } from '@/features/siteBuilder/public/sugestoesDeLugar';
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
  /** O catálogo: de onde saem as sugestões do campo de lugar. */
  items: PortalProperty[];
  /** Avisado quando a pessoa troca de aba (a captura de contato acompanha). */
  onTab?: (tab: AbaId) => void;
  /** Quem desenha: muda quantos campos cabem na primeira linha (`dividirCampos`). */
  modelo: ModeloDaCapa;
}

export type ModeloDaCapa = 'classico' | 'moderno';

/**
 * Até 4 campos de escolha cabem na primeira linha; com mais, o resto vai pra "Mais filtros".
 * Moderno: 3 na barra (o botão Buscar fecha a linha). Clássico: a linha tem 4 colunas, então
 * fica com 4 campos; se o texto de lugar estiver entre os 3 primeiros, ele ocupa 2 colunas e
 * a linha fecha com 3 (ver `lugarLargo`).
 */
export function dividirCampos(selects: CampoDeEscolha[], modelo: ModeloDaCapa): { primeira: CampoDeEscolha[]; mais: CampoDeEscolha[] } {
  if (selects.length <= 4) return { primeira: selects, mais: [] };
  const n = modelo === 'classico' && !selects.slice(0, 3).includes('place') ? 4 : 3;
  return { primeira: selects.slice(0, n), mais: selects.slice(n) };
}

/** Clássico com "Mais filtros": o lugar na primeira linha de 3 ocupa 2 das 4 colunas. */
export function lugarLargo(primeira: CampoDeEscolha[], mais: CampoDeEscolha[]): boolean {
  return mais.length > 0 && primeira.length === 3 && primeira.includes('place');
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

/** Fotos do fundo da capa: a lista do servidor (1 a 6); sem ela, a foto única de `fotoDaCapa`. */
export function fotosDaCapa(site: SiteInfo, items: PortalProperty[]): string[] {
  const lista = (site.hero?.image_urls ?? []).filter(Boolean);
  return lista.length ? lista : [fotoDaCapa(site, items)];
}

export function useBuscaDaCapa({ home, tenant, abas, cities, hoods, types, items, onTab, modelo }: PropsDaBusca) {
  const navigate = useNavigate();
  const ctx = useCtxDoSite(tenant);
  // Sem aba visível (catálogo vazio ou todas desligadas), a busca cai em Comprar.
  const [tab, setTab] = useState<AbaId>(abas[0] ?? 'sale');
  const [valores, setValores] = useState<Partial<Record<CampoBusca, string>>>({});
  // Lugar escolhido numa sugestão (condomínio, bairro ou cidade); `valores.place` é o texto do campo.
  const [lugar, setLugar] = useState<SugestaoDeLugar | null>(null);
  const [abertos, setAbertos] = useState(false);
  const set = (k: CampoBusca) => (v: string) => setValores(s => ({ ...s, [k]: v }));

  // Fase é de empreendimento, e Alugar não tem empreendimento: o campo some nessa aba.
  const campos = CAMPOS_BUSCA.filter(c => home.search.fields.includes(c) && !(c === 'stage' && tab === 'rent'));
  const selects = campos.filter((c): c is CampoDeEscolha => c !== 'code');
  const { primeira, mais } = dividirCampos(selects, modelo);
  const temCodigo = campos.includes('code');
  const escolherLugar = (s: SugestaoDeLugar) => { setLugar(s); setValores(v => ({ ...v, place: s.rotulo })); };
  const alternarMais = () => setAbertos(a => !a);

  const trocarAba = (k: AbaId) => {
    // As faixas de preço do aluguel são outras: a faixa marcada não vale mais.
    if (faixasDePreco(k) !== faixasDePreco(tab)) setValores(s => ({ ...s, price: '' }));
    if (k === 'rent') setValores(s => ({ ...s, stage: '' }));
    // As sugestões são da aba: o lugar escolhido (e o texto dele) não vale na outra.
    if (lugar) { setLugar(null); setValores(s => ({ ...s, place: '' })); }
    setTab(k);
    onTab?.(k);
  };

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tab !== 'sale') params.set('tab', tab);
    for (const c of campos) {
      const v = valores[c];
      if (!v) continue;
      if (c === 'place') {
        // Texto que ainda é o da sugestão escolhida vai com os filtros dela; mexeu no texto, é texto livre.
        if (lugar && lugar.rotulo === v) {
          for (const [k, n] of Object.entries(lugar.filtros)) if (n) params.set(k, n);
        } else if (v.trim()) {
          params.set('place', v.trim());
        }
      } else if (c === 'price') {
        for (const [k, n] of Object.entries(precoDaFaixa(tab, v))) params.set(k, n);
      } else {
        params.set(c, v);
      }
    }
    const qs = params.toString();
    navigate(caminhoDoSite(ctx, `/imoveis${qs ? `?${qs}` : ''}`));
  };

  const opcoes: Record<CampoDeEscolha, { label: string; options: [string, string][] }> = {
    type: { label: 'Tipo', options: opcoesDeTipo(types) },
    city: { label: 'Cidade', options: cities.map(c => [c, c]) },
    neighborhood: { label: 'Bairro', options: hoods.map(h => [h, h]) },
    price: { label: 'Faixa de preço', options: faixasDePreco(tab).map(f => [f.valor, f.rotulo]) },
    bedrooms: { label: 'Dormitórios', options: ATE_4 },
    suites: { label: 'Suítes', options: ATE_3 },
    parking: { label: 'Vagas', options: ATE_3 },
    area: { label: 'Área', options: AREAS_MINIMAS },
    place: { label: 'Condomínio, bairro ou cidade', options: [] },
    stage: { label: 'Fase', options: FASES_DO_PUBLICO.map(f => [f.valor, f.rotulo]) },
  };

  return { tab, trocarAba, valores, set, selects, primeira, mais, abertos, alternarMais, escolherLugar, items, temCodigo, runSearch, opcoes };
}

/** O que a busca da capa entrega pra quem desenha o formulário. */
export type BuscaDaCapa = ReturnType<typeof useBuscaDaCapa>;
