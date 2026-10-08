// "Onde divulgar" (Fase 4, Imóveis, entrega 3). Depois de criar o imóvel é o
// passo 2 (?passo=divulgar); na edição é o cartão da seção. Nos dois, cada
// clique grava na hora — não há botão Salvar. Erro: volta a chave e avisa.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Switch } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { plural } from '@/lib/formato';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import {
  portalsService, type Portal, type PortalAdType, type PortalPublication,
} from '@/services/portals/portalsService';
import { extractError } from '@/utils/apiHelpers';
import { contarPorTipo, estourosDoErro, mensagemDeEstouro, temTiposDeAnuncio, tipoBase } from '@/features/portals/adPlan';
import { ABA_NA_URL, tipoDoImovel } from '@/features/properties/listingKind';

const ROTA_DOS_PORTAIS = '/settings/portals';

type Marca = 'published_on_site' | 'ai_enabled' | 'featured';

interface EstadoDoPortal {
  portal: Portal;
  /** Não deu para ler as publicações do portal: a linha avisa e não grava. */
  erro: boolean;
  pubs: PortalPublication[];
  /** Modo legado (servidor sem `ad_types`): ids e destaques. */
  ids: string[];
  featuredIds: string[];
  salvando: boolean;
}

interface Props {
  imovel: Property;
  modo: 'passo' | 'cartao';
  /** Só o que mudou (a marca gravada): quem recebe junta no imóvel que já tem. */
  aoMudarImovel: (patch: Partial<Property>) => void;
  aoConcluir?: () => void;
}

const mensagemDe = (err: unknown, reserva: string) => extractError(err).message || reserva;

// Tipo que o catálogo do portal conhece; o desconhecido conta no base (é o que o servidor faz).
function tipoEfetivo(adTypes: PortalAdType[], adType: string | null | undefined): string | null {
  if (adType == null) return null;
  return adTypes.some(t => t.key === adType) ? adType : (tipoBase(adTypes)?.key ?? null);
}

export default function OndeDivulgar({ imovel, modo, aoMudarImovel, aoConcluir }: Props) {
  const navigate = useNavigate();
  const [marcas, setMarcas] = useState<Record<Marca, boolean>>({
    published_on_site: imovel.published_on_site ?? false,
    ai_enabled: imovel.ai_enabled ?? true,
    featured: imovel.featured ?? false,
  });
  const [salvandoMarca, setSalvandoMarca] = useState<Record<Marca, boolean>>({ published_on_site: false, ai_enabled: false, featured: false });
  const [estados, setEstados] = useState<EstadoDoPortal[] | null>(null);
  const [naoConectados, setNaoConectados] = useState(0);
  const [erroDeCarga, setErroDeCarga] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const todos = await portalsService.list();
        const conectados = todos.filter(p => p.connected && p.is_enabled);
        const lidos = await Promise.all(conectados.map(async (portal): Promise<EstadoDoPortal> => {
          const vazio = { portal, pubs: [], ids: [], featuredIds: [], salvando: false };
          try {
            const d = await portalsService.get(portal.portal_key);
            const pubs = d.publications ?? [];
            return {
              ...vazio, erro: false, pubs,
              ids: d.property_ids ?? [], featuredIds: d.featured_property_ids ?? [],
            };
          } catch {
            return { ...vazio, erro: true };
          }
        }));
        if (!vivo) return;
        setEstados(lidos);
        setNaoConectados(todos.length - conectados.length);
      } catch {
        if (vivo) setErroDeCarga(true);
      }
    })();
    return () => { vivo = false; };
  }, [imovel.id]);

  const mudarMarca = async (campo: Marca, valor: boolean) => {
    const anterior = marcas[campo];
    setMarcas(m => ({ ...m, [campo]: valor }));
    setSalvandoMarca(m => ({ ...m, [campo]: true }));
    try {
      const salvo = await propertiesService.update(imovel.id, { [campo]: valor });
      // Só a marca tocada vai para cima: fotos e o resto do imóvel não voltam ao que eram.
      aoMudarImovel({ [campo]: salvo[campo] ?? valor });
    } catch (err) {
      setMarcas(m => ({ ...m, [campo]: anterior }));
      toast.error(mensagemDe(err, 'Não foi possível salvar. Tente de novo.'));
    } finally {
      setSalvandoMarca(m => ({ ...m, [campo]: false }));
    }
  };

  const mexer = (key: string, patch: Partial<EstadoDoPortal>) =>
    setEstados(prev => prev && prev.map(e => (e.portal.portal_key === key ? { ...e, ...patch } : e)));

  // O servidor SUBSTITUI a lista do portal: o que faltar nela é pausado. Por isso
  // a lista nova sai de uma leitura feita AGORA, não da de quando a tela abriu
  // (outro imóvel pode ter entrado no portal nesse meio-tempo).
  // `proximo` é o tipo novo deste imóvel; nulo = tirar do portal.
  const gravar = async (e: EstadoDoPortal, proximo: string | null) => {
    const key = e.portal.portal_key;
    const antes = { portal: e.portal, pubs: e.pubs, ids: e.ids, featuredIds: e.featuredIds };
    mexer(key, { salvando: true });
    try {
      const fresco = await portalsService.get(key);
      const tipos = fresco.ad_types ?? e.portal.ad_types ?? [];
      const legado = tipos.length === 0;
      const freshPubs = fresco.publications ?? [];
      const outras = freshPubs.filter(p => p.property_id !== imovel.id);
      const freshIds = fresco.property_ids ?? [];
      const freshDestaques = fresco.featured_property_ids ?? [];
      if (!legado && proximo !== null) {
        // Entrar num tipo cheio o servidor recusa: avisa aqui, sem requisição.
        const alvo = tipos.find(t => t.key === proximo);
        const ocupados = contarPorTipo(tipos, new Map(outras.map(p => [p.property_id, p.ad_type])));
        if (alvo && alvo.limit != null && (ocupados[alvo.key] ?? 0) >= alvo.limit) {
          mexer(key, { portal: { ...e.portal, ad_types: tipos }, pubs: freshPubs, ids: freshIds, featuredIds: freshDestaques, salvando: false });
          toast.error(`${alvo.label} está com a cota cheia no ${e.portal.name} (${alvo.limit} de ${alvo.limit}).`);
          return;
        }
      }
      const pubs = proximo === null ? outras : [...outras, { property_id: imovel.id, ad_type: proximo }];
      const ids = proximo === null ? freshIds.filter(i => i !== imovel.id) : [...new Set([...freshIds, imovel.id])];
      const featuredIds = freshDestaques.filter(i => i !== imovel.id);
      // Quem não ENTRA num tipo cheio (desligar, ou mudar para um com vaga) segue
      // mesmo com o portal já acima da cota: sem a confirmação o servidor recusaria.
      const res = legado
        ? await portalsService.updatePublicationsLegacy(key, ids, featuredIds)
        : await portalsService.updatePublications(key, pubs, { confirmOverflow: true });
      mexer(key, {
        portal: { ...e.portal, ad_types: res?.ad_types ?? tipos },
        pubs: legado ? [] : (res?.publications ?? pubs),
        ids: res?.property_ids ?? ids,
        featuredIds: res?.featured_property_ids ?? featuredIds,
        salvando: false,
      });
    } catch (err) {
      mexer(key, { ...antes, salvando: false });
      const estouros = estourosDoErro(err);
      toast.error(estouros.length > 0 ? mensagemDeEstouro(estouros) : mensagemDe(err, 'Não foi possível atualizar o portal.'));
    }
  };

  const sair = () => (aoConcluir ? aoConcluir() : navigate(`/properties?aba=${ABA_NA_URL[tipoDoImovel(imovel)]}`));

  const linkIntegracoes = (
    <Link to={ROTA_DOS_PORTAIS} className="text-primary hover:underline">conecte em Integrações →</Link>
  );

  const linkConectar = (
    <Link to={ROTA_DOS_PORTAIS} className="text-primary hover:underline">Conecte em Integrações →</Link>
  );

  const linhaDoPortal = (e: EstadoDoPortal) => {
    const { portal } = e;
    const tipos = portal.ad_types ?? [];
    const legado = !temTiposDeAnuncio(portal);
    const meu = e.pubs.find(p => p.property_id === imovel.id);
    const ligado = legado ? e.ids.includes(imovel.id) : !!meu;
    const atual = tipoEfetivo(tipos, meu?.ad_type);
    const tipoAtual = tipos.find(t => t.key === atual);
    const contagens = contarPorTipo(tipos, new Map(e.pubs.map(p => [p.property_id, p.ad_type])));
    const contar = (t: PortalAdType) => contagens[t.key] ?? 0;
    const cheio = (t: PortalAdType) => t.limit != null && contar(t) >= t.limit;
    return (
      <div key={portal.portal_key} data-testid={`portal-${portal.portal_key}`} className="flex flex-wrap items-center gap-3 py-3">
        <span className="min-w-0 flex-1 text-sm font-medium">{portal.name}</span>
        {e.erro ? (
          <span className="text-xs text-muted-foreground">Não foi possível ler este portal agora.</span>
        ) : (
          <>
            {ligado && !legado && tipos.length > 1 && (
              <div className="w-40">
                <Seletor
                  className="w-full"
                  aria-label={`Tipo de anúncio no ${portal.name}`}
                  value={atual ?? ''}
                  disabled={rascunho || e.salvando}
                  onChange={ev => gravar(e, ev.target.value)}
                >
                  {tipos.map(t => (
                    <option key={t.key} value={t.key} disabled={cheio(t) && t.key !== atual}>{t.label}</option>
                  ))}
                </Seletor>
              </div>
            )}
            {ligado && tipoAtual && tipoAtual.limit != null && (
              <span className={`text-xs ${contar(tipoAtual) >= tipoAtual.limit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {contar(tipoAtual)} de {tipoAtual.limit}
              </span>
            )}
            <Switch
              aria-label={`Publicar no ${portal.name}`}
              checked={ligado}
              disabled={rascunho || e.salvando}
              onCheckedChange={v => gravar(e, v ? (tipoBase(tipos)?.key ?? 'standard') : null)}
            />
          </>
        )}
      </div>
    );
  };

  const rascunho = imovel.status === 'draft';

  const MARCAS: { campo: Marca; rotulo: string }[] = [
    { campo: 'published_on_site', rotulo: 'Publicar no site' },
    { campo: 'ai_enabled', rotulo: 'IA Vendedora pode oferecer' },
    { campo: 'featured', rotulo: 'Destaque' },
  ];

  return (
    <div className="space-y-4">
      {rascunho && (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-500">
          Este imóvel está em rascunho: nada sai no site, nos portais nem na IA até a situação mudar para Disponível.
        </p>
      )}
      <div className="space-y-3">
        {MARCAS.map(({ campo, rotulo }) => (
          <div key={campo} className="flex items-center justify-between gap-3">
            <span className="text-sm">{rotulo}</span>
            <Switch
              aria-label={rotulo}
              checked={marcas[campo]}
              disabled={rascunho || salvandoMarca[campo]}
              onCheckedChange={v => mudarMarca(campo, v)}
            />
          </div>
        ))}
      </div>
      <div className="divide-y border-t">
        {erroDeCarga ? (
          <p className="pt-3 text-sm text-muted-foreground">Não foi possível carregar os portais agora.</p>
        ) : estados === null ? (
          <p className="pt-3 text-sm text-muted-foreground">Carregando portais...</p>
        ) : estados.length === 0 ? (
          <p className="pt-3 text-sm text-muted-foreground">Nenhum portal conectado. {linkConectar}</p>
        ) : (
          <>
            {estados.map(linhaDoPortal)}
            {naoConectados > 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                Outros {plural(naoConectados, 'portal', 'portais')}, {linkIntegracoes}
              </p>
            )}
          </>
        )}
      </div>
      {modo === 'passo' && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={sair}>Pular</Button>
          <Button onClick={sair}>Concluir</Button>
        </div>
      )}
    </div>
  );
}
