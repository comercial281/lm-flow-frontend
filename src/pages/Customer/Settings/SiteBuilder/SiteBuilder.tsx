import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { getTenantSlug } from '@/services/core/tenant';
import { useLeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import { siteRoutingFrom, siteRoutingPayload, type SiteRoutingState } from './siteLeadRouting';
import {
  siteBuilderService,
  Site,
  SiteFormData,
  type SiteFinancingPage,
  type SiteListingPage,
} from '@/services/siteBuilder/siteBuilderService';
import { type HeroImagePick } from '@/features/siteBuilder/HeroImagePicker';
import { EMPTY_HERO_IMAGE, heroImageChoiceFrom } from '@/features/siteBuilder/heroImage';
import {
  financingFrom, financingPayload, listingFrom, listingPayload, parseEmails,
} from '@/features/siteBuilder/portalPages';
import { erroGa4, erroGtm, erroPixel, normalizarGa4, normalizarGtm, normalizarPixel } from '@/features/siteBuilder/trackingIds';
import { resolverHome } from '@/features/siteBuilder/public/homeConfig';
import { resolverFichaDoAdmin } from '@/features/siteBuilder/public/fichaConfig';
import { resolverLista } from '@/features/siteBuilder/public/listaConfig';
import { telaDaUrl, telaInfo, trilhaDe, type TelaId } from '@/features/siteBuilder/meuSiteMenu';
import { enderecoDoSite, urlDaPrevia } from '@/features/siteBuilder/enderecoDoSite';
import { useTenantFeatures, useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import BarraSalvar from '@/components/base/BarraSalvar';
import MeuSiteBarra from './MeuSiteBarra';
import TelaPainel from './telas/TelaPainel';
import TelaAparencia from './telas/TelaAparencia';
import TelaBusca from './telas/TelaBusca';
import TelaVitrines from './telas/TelaVitrines';
import TelaChamadas from './telas/TelaChamadas';
import TelaMaisBuscados from './telas/TelaMaisBuscados';
import TelaFicha from './telas/TelaFicha';
import TelaLista from './telas/TelaLista';
import TelaFinanciamento from './telas/TelaFinanciamento';
import TelaAnuncie from './telas/TelaAnuncie';
import TelaEndereco from './telas/TelaEndereco';
import TelaDados from './telas/TelaDados';
import TelaDestino from './telas/TelaDestino';
import TelaGoogle from './telas/TelaGoogle';
import TelaPaginas from './telas/TelaPaginas';
import TelaBlog from './telas/TelaBlog';
import TelaContatos from './telas/TelaContatos';
import TelaAnuncios from './telas/TelaAnuncios';
import TelaRastreamento from './telas/TelaRastreamento';
import TelaRedes from './telas/TelaRedes';
import TelaTraducao from './telas/TelaTraducao';
import TelaMarcaDagua from './telas/TelaMarcaDagua';

// A landing de anúncio é liberada CLIENTE A CLIENTE pela Leal Mídia. O gate mora
// no ITEM "Páginas de anúncio" da barra do Meu site, nunca na rota nem no item
// de menu lateral: quem digita o endereço alcança a tela, como em todo o resto
// do produto. O item Meu site do menu continua com `featureKey: 'site_builder'`
// e não muda — portal e landing são duas vendas diferentes, por isso são duas
// chaves.
//
// ⚠️ A chave é escrita LITERAL na chamada do useClientToggle abaixo, e não
// através desta constante, de propósito: scripts/sync-feature-catalog.mjs varre
// o código por REGEX e só reconhece string literal. Trocar por uma constante
// tira a chave do catálogo no deploy seguinte — o painel de Funções deixa de
// oferecer o botão de liberar e ninguém é avisado.
const LANDINGS_KEY = 'landing_pages';

const EMPTY_SITE_FORM: SiteFormData = {
  name: '',
  slug: '',
  primary_domain: '',
  active: true,
  published: false,
  logo_url: '',
  favicon_url: '',
  hero_video_url: '',
  hero_image: { ...EMPTY_HERO_IMAGE },
  sections: { stats: true, lead_capture: true },
  primary_color: '#7C3AED',
  accent_color: '#9333EA',
  font_family: 'Inter',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  contact_address: '',
  seo_title: '',
  seo_description: '',
  gtm_id: '',
  ga4_measurement_id: '',
  facebook_pixel_id: '',
  social_links: {},
  translate: { enabled: false, languages: ['en', 'es'] },
  watermark: { enabled: false, position: 'center', opacity: 60 },
  custom_head_html: '',
  custom_body_html: '',
  google: { indexable: false },
};

export default function SiteBuilder() {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);

  // Tela no endereço (`?tela=`) pra dar link direto (o "voltar" do editor de
  // landing aponta pra cá; `?tab=` antigo ainda resolve). `replace` de
  // propósito: sem ele o botão Voltar do navegador passa a percorrer as telas
  // em vez de sair da página. Sem site ainda, só a tela Endereço abre: é onde
  // se cria o site.
  const [searchParams, setSearchParams] = useSearchParams();

  // Gate das páginas de anúncio: default DESLIGADO, a Leal Mídia sempre vê.
  // `archivedKeys` é a camada acima — tira o item do ar pra TODO MUNDO, inclusive
  // a Leal Mídia, enquanto algo estiver em obra (painel Clientes > Arquivados).
  const { archivedKeys } = useTenantFeatures();
  const isSuper = useIsSuperAdmin();
  const landingsToggle = useClientToggle('landing_pages');
  const canLandings = !archivedKeys?.includes(LANDINGS_KEY) && (isSuper || landingsToggle);
  // Só o super-admin recebe o aviso "oculto pro cliente" — o cliente sem a chave
  // nem vê o item, então nunca veria o aviso.
  const landingsHiddenFromClient = isSuper && !landingsToggle;
  // `?tela=anuncios` sem a função liberada cai no Painel: o título de uma coisa
  // que o cliente não comprou nunca aparece.
  const telaDoEndereco = site ? telaDaUrl(searchParams) : 'endereco';
  const tela: TelaId = telaDoEndereco === 'anuncios' && !canLandings ? 'painel' : telaDoEndereco;
  const irPara = useCallback((t: TelaId) => {
    setSearchParams(t === 'painel' ? {} : { tela: t }, { replace: true });
  }, [setSearchParams]);
  const [saving, setSaving] = useState(false);

  // Site form
  const [siteForm, setSiteForm] = useState<SiteFormData>(EMPTY_SITE_FORM);
  const [siteFormDirty, setSiteFormDirty] = useState(false);
  // `home` só viaja no Salvar se uma tela da página inicial mexeu nele: quem nunca abriu
  // essas telas não grava o padrão de fábrica ao salvar, por exemplo, o logo.
  const [homeAlterado, setHomeAlterado] = useState(false);
  // Mesmo molde pra Página do imóvel e Lista de imóveis: cada bloco só viaja se a tela dele mexeu.
  const [fichaAlterada, setFichaAlterada] = useState(false);
  const [listaAlterada, setListaAlterada] = useState(false);
  // "Aparecer no Google": o bloco só viaja se a caixinha mexeu.
  const [googleAlterado, setGoogleAlterado] = useState(false);

  // Destino do lead por finalidade (venda/locação), com roleta e responsável.
  // Mora fora do siteForm: a venda sai das colunas lead_*, o resto de lead_routing.
  const [leadRouting, setLeadRouting] = useState<SiteRoutingState>(() => siteRoutingFrom(null));
  const destinationOptions = useLeadDestinationOptions({ withLabels: true });
  // Servidor antigo não conhece roleta/responsável no site: esses seletores somem.
  const routingOptions = leadRouting.supported
    ? destinationOptions
    : { ...destinationOptions, roletas: null, users: null };

  // Prévia da foto de imóvel recém-escolhida para o banner da home. Fica aqui
  // (e não na tela Aparência) porque é o Salvar que a limpa: depois de salvo,
  // quem diz qual imagem o site serve é o servidor (site.hero_image.url).
  const [heroPickPreview, setHeroPickPreview] = useState<HeroImagePick | null>(null);

  // As duas páginas extras do portal. Estado PRÓPRIO (e não dentro do
  // formulário do site) porque o que a tela edita é o RESOLVIDO — os cinco
  // bancos com nome e cor vêm do servidor — e o que é enviado é outra coisa,
  // montada por `financingPayload`/`listingPayload` na hora de salvar. Duas
  // formas para a mesma coisa dentro do mesmo estado é onde nascem as duas
  // verdades que este repo passa a vida desfazendo.
  const [financingPage, setFinancingPage] = useState<SiteFinancingPage>(() => financingFrom(null));
  const [listingPage, setListingPage] = useState<SiteListingPage>(() => listingFrom(null));
  const [emailsText, setEmailsText] = useState('');

  const loadSite = useCallback(async () => {
    setLoading(true);
    try {
      const sites = await siteBuilderService.listSites();
      if (sites.length > 0) {
        setSite(sites[0]);
        const s = sites[0];
        setSiteForm({
          name: s.name,
          slug: s.slug,
          primary_domain: s.primary_domain ?? '',
          active: s.active,
          published: s.published,
          logo_url: s.branding.logo_url ?? '',
          favicon_url: s.branding.favicon_url ?? '',
          hero_video_url: s.hero_video_url ?? '',
          hero_image: heroImageChoiceFrom(s.hero_image),
          sections: {
            stats: s.sections?.stats ?? true,
            lead_capture: s.sections?.lead_capture ?? true,
          },
          home: resolverHome(s.home),
          // Do ADMIN: o único resolvedor que traz os e-mails da cópia (o do site público não traz).
          property_page: resolverFichaDoAdmin(s.property_page),
          listing: resolverLista(s.listing),
          primary_color: s.branding.primary_color ?? '#7C3AED',
          accent_color: s.branding.accent_color ?? '#9333EA',
          font_family: s.branding.font_family ?? 'Inter',
          contact_phone: s.contact.phone ?? '',
          contact_whatsapp: s.contact.whatsapp ?? '',
          contact_email: s.contact.email ?? '',
          contact_address: s.contact.address ?? '',
          seo_title: s.seo.title ?? '',
          seo_description: s.seo.description ?? '',
          gtm_id: s.tracking.gtm_id ?? '',
          ga4_measurement_id: s.tracking.ga4_measurement_id ?? '',
          facebook_pixel_id: s.tracking.facebook_pixel_id ?? '',
          social_links: s.social_links ?? {},
          translate: s.translate ?? { enabled: false, languages: ['en', 'es'] },
          watermark: {
            enabled: s.watermark?.enabled ?? false,
            position: s.watermark?.position ?? 'center',
            opacity: s.watermark?.opacity ?? 60,
          },
          custom_head_html: s.custom_code?.head ?? '',
          custom_body_html: s.custom_code?.body ?? '',
          // Servidor velho não manda `google`: desligado, o padrão de fábrica.
          google: { indexable: s.google?.indexable === true },
        });
        setHomeAlterado(false);
        setFichaAlterada(false);
        setListaAlterada(false);
        setGoogleAlterado(false);
        setLeadRouting(siteRoutingFrom(s));
        const fin = financingFrom(s);
        const lst = listingFrom(s);
        setFinancingPage(fin);
        setListingPage(lst);
        setEmailsText((lst.emails ?? []).join(', '));
      }
    } catch {
      toast.error('Erro ao carregar site');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSite(); }, [loadSite]);

  const handleSaveSite = async () => {
    // Código de rastreamento torto não vai pro servidor: a tela avisa e leva até o campo.
    const erroRastreio =
      erroGa4(siteForm.ga4_measurement_id ?? '')
      ?? erroPixel(siteForm.facebook_pixel_id ?? '')
      ?? erroGtm(siteForm.gtm_id ?? '');
    if (erroRastreio) {
      toast.error(erroRastreio);
      irPara('rastreamento');
      return;
    }
    setSaving(true);
    try {
      // primary_domain é gerenciado pelo card "Domínio próprio" (que também
      // registra o domínio na Vercel). Mandá-lo aqui sobrescreveria o valor.
      const payload: SiteFormData = { ...siteForm };
      delete payload.primary_domain;
      if (!homeAlterado) delete payload.home;
      if (!fichaAlterada) delete payload.property_page;
      // `email_copy` vai SEMPRE como lista: texto ou null o permit do servidor descarta
      // em silêncio, o merge mantém os e-mails ANTIGOS e a tela diria "Salvo" sem ter
      // mudado nada. Campo em branco não viaja.
      else if (payload.property_page) {
        payload.property_page = {
          ...payload.property_page,
          email_copy: (payload.property_page.email_copy ?? []).map(e => e.trim()).filter(Boolean),
        };
      }
      if (!listaAlterada) delete payload.listing;
      // `google` vai sempre INTEIRO (permit aninhado no servidor) e só se a caixinha mexeu.
      if (!googleAlterado) delete payload.google;
      else payload.google = { indexable: siteForm.google?.indexable === true };
      payload.ga4_measurement_id = normalizarGa4(siteForm.ga4_measurement_id ?? '');
      payload.facebook_pixel_id = normalizarPixel(siteForm.facebook_pixel_id ?? '');
      payload.gtm_id = normalizarGtm(siteForm.gtm_id ?? '');
      // As duas páginas extras: o que a tela edita é o resolvido; o que viaja é
      // o payload enxuto (texto igual ao de fábrica não vai). Cada uma é gravada
      // sozinha no servidor — salvar uma não apaga a outra.
      payload.financiamento = financingPayload(financingPage);
      payload.anuncie = listingPayload({ ...listingPage, emails: parseEmails(emailsText) });
      Object.assign(payload, siteRoutingPayload(leadRouting, routingOptions));
      if (site) {
        const updated = await siteBuilderService.updateSite(site.id, payload);
        setSite(updated);
        // O campo mostra o código já normalizado, igual ao que foi gravado.
        setSiteForm(prev => ({
          ...prev,
          ga4_measurement_id: payload.ga4_measurement_id,
          facebook_pixel_id: payload.facebook_pixel_id,
          gtm_id: payload.gtm_id,
          // O servidor sanea (tira atalho sem rótulo, apara texto): a tela mostra o que ficou gravado.
          home: resolverHome(updated.home),
          property_page: resolverFichaDoAdmin(updated.property_page),
          listing: resolverLista(updated.listing),
          // A caixinha mostra o que ficou gravado; servidor velho sem `google` mantém a tela.
          google: updated.google ? { indexable: updated.google.indexable === true } : prev.google,
        }));
        setHomeAlterado(false);
        setFichaAlterada(false);
        setListaAlterada(false);
        setGoogleAlterado(false);
        setLeadRouting(siteRoutingFrom(updated));
        // Salvo: a prévia do banner passa a vir do servidor (site.hero_image).
        setHeroPickPreview(null);
        // E as duas páginas voltam do servidor RESOLVIDAS: é ele quem conhece os
        // cinco bancos e os textos de fábrica.
        const savedFin = financingFrom(updated);
        const savedLst = listingFrom(updated);
        setFinancingPage(savedFin);
        setListingPage(savedLst);
        setEmailsText((savedLst.emails ?? []).join(', '));
        toast.success('Site atualizado');
      } else {
        const created = await siteBuilderService.createSite(payload);
        setSite(created);
        setLeadRouting(siteRoutingFrom(created));
        toast.success('Site criado');
      }
      setSiteFormDirty(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar site'));
    } finally {
      setSaving(false);
    }
  };

  const setF = (field: Partial<SiteFormData>) => {
    setSiteForm(prev => ({ ...prev, ...field }));
    if ('home' in field) setHomeAlterado(true);
    if ('property_page' in field) setFichaAlterada(true);
    if ('listing' in field) setListaAlterada(true);
    if ('google' in field) setGoogleAlterado(true);
    setSiteFormDirty(true);
  };

  // Telas que mexem em estado fora do siteForm (financiamento, anuncie, destino)
  // marcam o formulário como alterado por aqui.
  const marcarAlterado = useCallback(() => setSiteFormDirty(true), []);

  // Descartar volta ao que está gravado no servidor.
  const descartar = async () => {
    await loadSite();
    setHeroPickPreview(null);
    setSiteFormDirty(false);
  };

  useAlteracoesNaoSalvas(!!site && siteFormDirty);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Carregando site...
      </div>
    );
  }

  // Com domínio próprio ativo, "Ver site" abre o domínio; sem ele, o endereço lmflow.
  const endereco = enderecoDoSite(site ?? {}, { origin: window.location.origin, tenant: getTenantSlug() });
  const noAr = !!site?.published && !!site?.active;
  // Em manutenção o site não abre: "Ver prévia" pede um link de 24 h.
  const pedirPrevia = async () => {
    if (!site) throw new Error('sem site');
    const { token } = await siteBuilderService.previewLink(site.id);
    return urlDaPrevia(endereco.url, token);
  };
  const info = telaInfo(tela);
  const trilha = trilhaDe(tela);
  const formProps = { site, siteForm, setF };

  return (
    <div className="flex min-h-full flex-col">
      {site && (
        <MeuSiteBarra
          tela={tela}
          aoIr={irPara}
          enderecoVisivel={endereco.visivel}
          urlDoSite={endereco.url}
          noAr={noAr}
          aoPedirPrevia={pedirPrevia}
          podeAnuncios={canLandings}
        />
      )}
      <div className="mx-auto w-full max-w-[1400px] space-y-5 px-6 py-6">
        <div className="space-y-1">
          {trilha && <p className="text-xs font-medium text-muted-foreground">{trilha}</p>}
          <h1 className="text-2xl font-semibold">{site ? info.titulo : 'Criar o site'}</h1>
          <p className="text-sm text-muted-foreground">
            {site ? info.frase : 'Dê um nome e um endereço para o site da imobiliária.'}
          </p>
        </div>

        {site && tela === 'painel' && <TelaPainel site={site} irPara={irPara} setF={setF} podeAnuncios={canLandings} />}
        {tela === 'aparencia' && (
          <TelaAparencia {...formProps} heroPickPreview={heroPickPreview} setHeroPickPreview={setHeroPickPreview} />
        )}
        {tela === 'busca' && <TelaBusca {...formProps} />}
        {tela === 'vitrines' && <TelaVitrines {...formProps} />}
        {tela === 'chamadas' && <TelaChamadas {...formProps} />}
        {tela === 'buscados' && <TelaMaisBuscados {...formProps} />}
        {tela === 'ficha' && <TelaFicha {...formProps} />}
        {tela === 'lista' && <TelaLista {...formProps} />}
        {tela === 'financiamento' && (
          <TelaFinanciamento financingPage={financingPage} setFinancingPage={setFinancingPage} marcarAlterado={marcarAlterado} />
        )}
        {tela === 'anuncie' && (
          <TelaAnuncie
            site={site}
            listingPage={listingPage}
            setListingPage={setListingPage}
            emailsText={emailsText}
            setEmailsText={setEmailsText}
            alterado={siteFormDirty}
            marcarAlterado={marcarAlterado}
          />
        )}
        {tela === 'endereco' && <TelaEndereco {...formProps} aoCriar={handleSaveSite} salvando={saving} />}
        {tela === 'dados' && <TelaDados {...formProps} />}
        {tela === 'destino' && (
          <TelaDestino
            leadRouting={leadRouting}
            setLeadRouting={setLeadRouting}
            routingOptions={routingOptions}
            marcarAlterado={marcarAlterado}
          />
        )}
        {tela === 'google' && <TelaGoogle {...formProps} />}
        {tela === 'rastreamento' && <TelaRastreamento {...formProps} irPara={irPara} />}
        {tela === 'redes' && <TelaRedes {...formProps} />}
        {tela === 'traducao' && <TelaTraducao {...formProps} />}
        {tela === 'marca' && <TelaMarcaDagua {...formProps} onLogoAtualizado={setSite} />}
        {site && tela === 'paginas' && <TelaPaginas site={site} />}
        {site && tela === 'blog' && <TelaBlog site={site} />}
        {site && tela === 'contatos' && <TelaContatos site={site} />}
        {site && tela === 'anuncios' && canLandings && (
          <TelaAnuncios site={site} landingsHiddenFromClient={landingsHiddenFromClient} />
        )}

        <BarraSalvar visivel={!!site && siteFormDirty} salvando={saving} aoSalvar={handleSaveSite} aoDescartar={descartar} />
      </div>
    </div>
  );
}
