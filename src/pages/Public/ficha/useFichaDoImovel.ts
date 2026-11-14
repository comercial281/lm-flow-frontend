import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useCtxDoSite, useTenantDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { linhaDoAtendimento, linhaDoCreci } from '@/features/siteBuilder/public/creci';
import { TEXTO_FALHA_DE_ENVIO, textoDoErroDeEnvio } from '@/features/siteBuilder/public/limiteDeEnvios';
import { cabecalhosDoSite, ehPrevia, envioFoiPrevia } from '@/features/siteBuilder/public/previa';
import { comModeloDaPrevia, ehPreviaDoModelo } from '@/features/siteBuilder/public/previaDoModelo';
import { trackLead } from '@/features/siteBuilder/public/siteTracking';
import { isValidBrPhone } from '@/lib/brPhone';
import { labelsFor } from '@/features/properties/amenities';
import type { PropertyTypology } from '@/features/properties/typologies';
import { estaEmManutencao, robotsDoSite, tokensDoSite, type PortalProperty, type SiteInfo } from '../portalShared';
import { resolverHome, type AbaId } from '@/features/siteBuilder/public/homeConfig';
import { usePortalTracking } from '../usePortalTracking';
import { useIconeDaAba } from '@/features/siteBuilder/public/useIconeDaAba';
import { FINALIDADE_PARAM, finalidadeDoImovel, finalidadeInicial, type Finalidade } from '../finalidade';
import { consultaDoMapa } from '../mapaDoImovelPublico';
import { enderecoDaPagina, linkDoWhatsAppCom, mensagemDoImovel } from '../whatsappDoSite';
import { rotuloTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { resolverFicha } from '@/features/siteBuilder/public/fichaConfig';
import {
  construtoraDoImovel, dadosDoPredio, faseDoImovel, fichaDoImovel, selosDoImovel, sufixoDoIptu,
  type CamposDaFicha, type FichaDoImovel,
} from './fichaDoImovel';
import { I } from './iconesDaFicha';

/* ────────────────────────────────────────────────────────────────────────────
   Lógica da ficha do imóvel, a mesma pros dois desenhos (Clássico e Moderno):
   carga do site e do imóvel, SEO (título, descrição, robots), visita e
   rastreamento, galeria (foto ativa, tela cheia e teclado), "Você também pode
   gostar", contato (Tenho interesse e book, prévia, trava de duplo envio) e os
   números já prontos pra desenhar.
──────────────────────────────────────────────────────────────────────────── */

export interface FotoDaFicha { file_url: string; thumbnail_url?: string | null; caption?: string | null; alt_text?: string | null; is_cover?: boolean }
// Os campos do C2 (CamposDaFicha) são todos opcionais: servidor velho não os
// manda e a ficha fica igual à de antes.
export interface PropertyDTO extends CamposDaFicha {
  id?: string; code: string; title: string; description?: string;
  transaction_type?: string; property_type?: string;
  sale_price?: number | null; rent_price?: number | null;
  condo_fee?: number | null; iptu?: number | null;
  bedrooms?: number | null; bathrooms?: number | null; suites?: number | null; parking_spaces?: number | null;
  useful_area_m2?: number | null; total_area_m2?: number | null;
  address_neighborhood?: string; address_city?: string; address_state?: string;
  // Só vêm preenchidos para empreendimento (revenda: null, só região).
  latitude?: number | null; longitude?: number | null;
  features?: string[] | null; condo_features?: string[] | null;
  typologies?: PropertyTypology[] | null;
  responsible_name?: string;
  /** Só vem quando a unidade está plugada num condomínio. */
  condominium_name?: string | null;
  /** CRECI de quem atende, já no formato "12345-F/SP" (servidor antigo não manda). */
  responsible_creci?: string | null;
  photos?: FotoDaFicha[];
  /** Só o booleano: o endereço do book nunca vem para a página pública. */
  has_book?: boolean;
}

const API = import.meta.env.VITE_API_URL as string;

function brl(n?: number | null) { return typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null; }
function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

/** Linha de valor (condomínio, IPTU, m²). */
export interface LinhaDeValor { label: string; value: string }
/** Número do imóvel (quartos, suítes...): ícone e texto. */
export interface NumeroDoImovel { d: string; label: string }

/**
 * O que a ficha mostra, já calculado a partir do imóvel e da "Página do
 * imóvel" (Personalizar). Os dois desenhos leem daqui: o que estiver vazio
 * não aparece.
 */
export function derivadosDaFicha(prop: PropertyDTO, ficha: FichaDoImovel, site: SiteInfo) {
  const photos = prop.photos ?? [];
  const typeLabel = rotuloTipo(prop.property_type || '');

  // Preço principal segue o tipo de transação (aluguel mostra "/mês"; venda, o
  // valor cheio). Locação sem venda cai no aluguel; senão, venda.
  const isRent = prop.transaction_type === 'rent' || prop.transaction_type === 'season';
  const price = brl(isRent ? prop.rent_price : prop.sale_price);
  const priceSuffix = isRent ? '/mês' : '';
  // Valor do m²: base de venda sobre a área útil (ou total como fallback).
  const areaForM2 = prop.useful_area_m2 || prop.total_area_m2 || 0;
  const pricePerM2 = !isRent && prop.sale_price && areaForM2 ? brl(prop.sale_price / areaForM2) : null;
  // Linha de valores recorrentes (condomínio / IPTU / m²), como nos portais.
  // Monta a linha a partir do RESULTADO do brl() (não do campo cru): se o valor
  // não formatar como número, a linha nem aparece — nunca renderiza "null".
  const feeRow = (label: string, n?: number | null, suffix = ''): LinhaDeValor | null => {
    const v = brl(n);
    return v ? { label, value: `${v}${suffix}` } : null;
  };
  const moneyRows = [
    feeRow('Condomínio', prop.condo_fee, '/mês'),
    feeRow('IPTU', prop.iptu, sufixoDoIptu(prop)),
    pricePerM2 ? { label: 'Valor do m²', value: pricePerM2 } : null,
  ].filter(Boolean) as LinhaDeValor[];
  // Revenda com "Valores" desligado: some a linha toda (aqui, no card e no celular).
  const money = ficha.valores ? moneyRows : [];
  // CRECI (todo anúncio de imóvel precisa): o da imobiliária junto do código,
  // e o de quem atende ao lado do nome. Sem número, nada aparece.
  const creciDaImobiliaria = linhaDoCreci(site.creci);
  const linhaDoCodigo = creciDaImobiliaria ? `Código ${prop.code} · ${creciDaImobiliaria}` : `Código ${prop.code}`;
  const atendimento = linhaDoAtendimento(prop.responsible_name, prop.responsible_creci);

  // Características/comodidades → rótulos (via catálogo compartilhado).
  const featureLabels = labelsFor(prop.features);
  const condoLabels = labelsFor(prop.condo_features);
  // Tipologias (plantas) do empreendimento: a tabela aparece com qualquer
  // tipologia cadastrada, até com uma só. [] quando não há nenhuma ou quando o
  // tenant ainda não recebeu a coluna (o backend devolve [] nesse caso).
  const typologies = ficha.tipologias ? prop.typologies ?? [] : [];

  // Localização (privacidade, decisão de 03/10): revenda: só a região (bairro/
  // cidade, sem rua/número); empreendimento: ponto exato — o servidor só manda
  // latitude/longitude para empreendimento.
  const local = consultaDoMapa(prop);
  const regionText = local?.legenda ?? '';
  const mapa = ficha.mapa ? local : null;

  const selos = selosDoImovel(prop, ficha);
  const fase = faseDoImovel(prop, ficha);
  const dadosDoPredioList = dadosDoPredio(prop, ficha);
  const construtora = construtoraDoImovel(prop, ficha);

  const specs = [
    prop.bedrooms ? { d: I.bed, label: `${prop.bedrooms} ${prop.bedrooms > 1 ? 'quartos' : 'quarto'}` } : null,
    prop.suites ? { d: I.suite, label: `${prop.suites} ${prop.suites > 1 ? 'suítes' : 'suíte'}` } : null,
    prop.bathrooms ? { d: I.bath, label: `${prop.bathrooms} ${prop.bathrooms > 1 ? 'banheiros' : 'banheiro'}` } : null,
    prop.parking_spaces ? { d: I.car, label: `${prop.parking_spaces} ${prop.parking_spaces > 1 ? 'vagas' : 'vaga'}` } : null,
    prop.useful_area_m2 ? { d: I.ruler, label: `${prop.useful_area_m2} m² úteis` } : null,
    prop.total_area_m2 ? { d: I.land, label: `${prop.total_area_m2} m² total` } : null,
  ].filter(Boolean) as NumeroDoImovel[];

  return {
    photos, typeLabel, isRent, price, priceSuffix, money, linhaDoCodigo, atendimento,
    featureLabels, condoLabels, typologies, regionText, mapa, selos, fase, dadosDoPredioList, construtora, specs,
  };
}

export type DerivadosDaFicha = ReturnType<typeof derivadosDaFicha>;

export function useFichaDoImovel() {
  const { code } = useParams<{ code: string }>();
  const tenant = useTenantDoSite();
  const ctx = useCtxDoSite(tenant ?? '');
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [site, setSite] = useState<SiteInfo>({});
  const [siteLoaded, setSiteLoaded] = useState(false);
  const [prop, setProp] = useState<PropertyDTO | null>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [suggestions, setSuggestions] = useState<PortalProperty[]>([]);
  // Site em manutenção: a ficha continua abrindo (o link vai por WhatsApp e
  // anúncio), mas o topo e o rodapé ficam só com logo e WhatsApp, o "Voltar aos
  // imóveis" some e "Você também pode gostar" também (a lista dá 404).
  const manutencao = estaEmManutencao(site);
  // "Página do imóvel" do Personalizar. Sem `property_page` (servidor velho),
  // padrão de fábrica: tudo ligado, a ficha de antes.
  const ficha = useMemo(() => (prop ? fichaDoImovel(prop, resolverFicha(site.property_page)) : null), [prop, site]);
  const parecidosLigados = ficha?.parecidos ?? false;
  const { pathname } = useLocation();
  usePortalTracking(state === 'ok' && siteLoaded ? site : null, tenant, { kind: 'property', path: pathname, propertyCode: code });
  useIconeDaAba(site.branding?.favicon_url);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState(false);
  const [sent, setSent] = useState(false);
  // Trava de duplo envio (ref: vale já no segundo clique) e aviso de falha.
  const enviandoRef = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [falhouEnvio, setFalhouEnvio] = useState<string | null>(null);
  // Pedido do book: o mesmo formulário de nome e telefone, em outro modo. O
  // endereço do PDF nunca passa por aqui: a página só sabe SE o imóvel tem book.
  const [pedindoBook, setPedindoBook] = useState(false);
  // Envio feito na prévia: o servidor não criou nada, e a tela não finge que criou.
  const [enviadoNaPrevia, setEnviadoNaPrevia] = useState(false);
  // Imóvel de Venda + Locação: a pessoa escolhe, marcada pela aba da busca de
  // onde veio (?finalidade=locacao). Os outros imóveis decidem sozinhos.
  const [searchParams] = useSearchParams();
  const [finalidade, setFinalidade] = useState<Finalidade>(() => finalidadeInicial(searchParams.get(FINALIDADE_PARAM)));

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tenant || !code) return;
      try {
        const [siteRes, imovelRes] = await Promise.all([
          fetch(`${API}/api/public/v1/site`, { headers: cabecalhosDoSite(tenant) }),
          fetch(`${API}/api/public/v1/site/properties/${encodeURIComponent(code)}`, { headers: cabecalhosDoSite(tenant) }),
        ]);
        if (!alive) return;
        if (!imovelRes.ok) { setState('notfound'); return; }
        // O back-end serializa o imóvel direto em `data` (objeto plano).
        const property = (await imovelRes.json()).data as PropertyDTO;
        // `?modelo=` (prévia do modelo): o visual trocado só no navegador.
        const siteInfo = siteRes.ok ? comModeloDaPrevia((await siteRes.json()).data as SiteInfo) : {};
        setSite(siteInfo);
        setSiteLoaded(siteRes.ok);
        setProp(property);

        const siteName = siteInfo.name || 'Imóveis';
        document.title = `${property.title} · ${siteName}`;
        const desc = (property.description || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (desc) setMeta('description', desc);
        // Mesma regra do resto do site: `index` só com o Google ligado, no ar e fora da prévia.
        setMeta('robots', robotsDoSite(siteRes.ok ? siteInfo : null));
        setState('ok');
      } catch { if (alive) setState('notfound'); }
    })();
    return () => { alive = false; };
  }, [tenant, code]);

  // Navegação por teclado + trava do scroll enquanto o lightbox está aberto
  useEffect(() => {
    if (!lightbox) return;
    const total = prop?.photos?.length ?? 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      else if (e.key === 'ArrowLeft' && total > 1) setActive(a => (a - 1 + total) % total);
      else if (e.key === 'ArrowRight' && total > 1) setActive(a => (a + 1) % total);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, prop]);

  // Imóveis recomendados (fim da página): o servidor escolhe os mais parecidos
  // com este (mesma finalidade; tipo, bairro, preço e quartos contam pontos).
  // Servidor velho, sem a rota /similar: a regra antiga, outros publicados da
  // MESMA cidade pela listagem pública. Desligado na "Página do imóvel": nada é pedido.
  useEffect(() => {
    if (!tenant || !code || !prop) return;
    if (manutencao || !parecidosLigados) { setSuggestions([]); return; }
    let alive = true;
    const fetchList = async (city?: string): Promise<PortalProperty[]> => {
      const qs = new URLSearchParams({ per_page: '8' });
      if (city) qs.set('city', city);
      try {
        const res = await fetch(`${API}/api/public/v1/site/properties?${qs.toString()}`, { headers: cabecalhosDoSite(tenant) });
        if (!res.ok) return [];
        return ((await res.json()).data as PortalProperty[]).filter(p => p.code !== code);
      } catch { return []; }
    };
    const fetchSimilar = async (): Promise<PortalProperty[] | null> => {
      try {
        const res = await fetch(`${API}/api/public/v1/site/properties/${encodeURIComponent(code)}/similar?limit=3`, { headers: cabecalhosDoSite(tenant) });
        if (!res.ok) return null;
        const data = (await res.json()).data;
        return Array.isArray(data) ? (data as PortalProperty[]).filter(p => p.code !== code) : null;
      } catch { return null; }
    };
    (async () => {
      const similar = await fetchSimilar();
      if (similar) { if (alive) setSuggestions(similar.slice(0, 3)); return; }
      let list = await fetchList(prop.address_city);
      // Fallback: se a cidade tiver poucos imóveis, completa com outros quaisquer.
      if (list.length < 3) {
        const extra = await fetchList();
        const seen = new Set(list.map(p => p.code));
        list = [...list, ...extra.filter(p => !seen.has(p.code))];
      }
      if (alive) setSuggestions(list.slice(0, 3));
    })();
    return () => { alive = false; };
  }, [tenant, code, prop, manutencao, parecidosLigados]);

  // Mesmas cores, fonte e fundo do resto do site (antes a ficha montava as
  // dela à mão, sem a cor de destaque, que pinta o selo Muito procurado).
  const { fontHrefs, cssVars, fundo } = useMemo(() => tokensDoSite(site), [site]);
  const wa = site.contact?.whatsapp;
  // Abas do topo e do rodapé: só o liga/desliga do Personalizar. A ficha não
  // carrega o catálogo inteiro, então não esconde aba sem imóvel como a home.
  const abas = useMemo(() => {
    const ligadas = resolverHome(site.home).search.tabs;
    return (['sale', 'rent', 'launch'] as AbaId[]).filter(k => ligadas[k]);
  }, [site]);
  // Link do imóvel na primeira linha: o endereço aberto agora (domínio que
  // estiver no ar), sem a query. Topo, rodapé e flutuante leem a mesma frase
  // pelo MensagemDoWhatsAppContext (ver whatsappDoSite.ts).
  const mensagemWa = useMemo(() => (prop
    ? mensagemDoImovel(enderecoDaPagina(window.location.origin, pathname), prop.code, prop.title)
    : null), [prop, pathname]);
  const waHref = useMemo(() => (mensagemWa ? linkDoWhatsAppCom(wa, mensagemWa) : null), [wa, mensagemWa]);

  const mostraBook = !!prop && resolverFicha(site.property_page).development.book_button
    && prop.listing_kind === 'development' && prop.has_book === true;

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !code || !name.trim()) return;
    if (!isValidBrPhone(phone)) { setPhoneErr(true); return; }
    // Prévia do modelo: o servidor não sabe dela, então nada é enviado.
    if (ehPreviaDoModelo(site)) { setFalhouEnvio(null); setEnviadoNaPrevia(true); setSent(true); return; }
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setFalhouEnvio(null);
    const params = new URLSearchParams(window.location.search);
    try {
      const res = await fetch(`${API}/api/public/v1/site/leads`, {
        method: 'POST', headers: cabecalhosDoSite(tenant, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lead: {
          name, phone, source: 'portal', form_type: pedindoBook ? 'imovel_book' : 'imovel',
          property_code: code, property_id: prop?.id,
          finalidade: finalidadeDoImovel(prop?.transaction_type) ?? finalidade,
          message: pedindoBook ? `Pediu o book do imóvel ${code}` : `Interesse no imóvel ${code}`,
          utm_source: params.get('utm_source') ?? undefined, utm_campaign: params.get('utm_campaign') ?? undefined,
          form_data: { page_url: window.location.href, referrer: document.referrer || null },
        } }),
      });
      const naPrevia = ehPrevia(site) || (res.ok && (await envioFoiPrevia(res)));
      // Só confirma quando o servidor aceitou (na prévia nada é enviado, e o aviso próprio aparece).
      if (!res.ok && !naPrevia) { setFalhouEnvio(await textoDoErroDeEnvio(res, TEXTO_FALHA_DE_ENVIO)); return; }
      setEnviadoNaPrevia(naPrevia);
      setSent(true);
      // Conversão só conta quando o servidor aceitou o contato (e nunca na prévia).
      if (res.ok && !naPrevia) trackLead();
    } catch { setFalhouEnvio(TEXTO_FALHA_DE_ENVIO); } finally { enviandoRef.current = false; setEnviando(false); }
  };

  const contato = {
    name, setName, phone, setPhone, phoneErr, setPhoneErr, sent, enviando, falhouEnvio, enviadoNaPrevia,
    pedindoBook, setPedindoBook, finalidade, setFinalidade, submitLead,
    /** Imóvel de Venda + Locação: a pessoa escolhe a finalidade no formulário. */
    escolheFinalidade: !!prop && !finalidadeDoImovel(prop.transaction_type),
  };

  return {
    code, tenant, ctx, state, site, prop, ficha, manutencao,
    active, setActive, lightbox, setLightbox, suggestions,
    fontHrefs, cssVars, fundo, wa, abas, waHref, mensagemWa, mostraBook, contato,
  };
}

export type Contato = ReturnType<typeof useFichaDoImovel>['contato'];
