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
import { telaDaUrl, telaInfo, trilhaDe, type TelaId } from '@/features/siteBuilder/meuSiteMenu';
import { useTenantFeatures, useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import BarraSalvar from '@/components/base/BarraSalvar';
import MeuSiteBarra from './MeuSiteBarra';
import TelaPainel from './telas/TelaPainel';
import TelaAparencia from './telas/TelaAparencia';
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
          hero_video_url: s.hero_video_url ?? '',
          hero_image: heroImageChoiceFrom(s.hero_image),
          sections: {
            stats: s.sections?.stats ?? true,
            lead_capture: s.sections?.lead_capture ?? true,
          },
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
        });
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
    setSaving(true);
    try {
      // primary_domain é gerenciado pelo card "Domínio próprio" (que também
      // registra o domínio na Vercel). Mandá-lo aqui sobrescreveria o valor.
      const payload: SiteFormData = { ...siteForm };
      delete payload.primary_domain;
      // As duas páginas extras: o que a tela edita é o resolvido; o que viaja é
      // o payload enxuto (texto igual ao de fábrica não vai). Cada uma é gravada
      // sozinha no servidor — salvar uma não apaga a outra.
      payload.financiamento = financingPayload(financingPage);
      payload.anuncie = listingPayload({ ...listingPage, emails: parseEmails(emailsText) });
      Object.assign(payload, siteRoutingPayload(leadRouting, routingOptions));
      if (site) {
        const updated = await siteBuilderService.updateSite(site.id, payload);
        setSite(updated);
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

  const portalUrl = `${window.location.origin}/portal/${getTenantSlug() ?? site?.slug ?? ''}`;
  const info = telaInfo(tela);
  const trilha = trilhaDe(tela);
  const formProps = { site, siteForm, setF };

  return (
    <div className="flex min-h-full flex-col">
      {site && (
        <MeuSiteBarra
          tela={tela}
          aoIr={irPara}
          enderecoVisivel={portalUrl.replace(/^https?:\/\//, '')}
          urlDoSite={portalUrl}
          noAr={!!site.published && !!site.active}
          podeAnuncios={canLandings}
        />
      )}
      <div className="mx-auto w-full max-w-6xl space-y-5 px-6 py-6">
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
