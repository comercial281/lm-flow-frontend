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
import { estourosDoErro, mensagemDeEstouro, temTiposDeAnuncio, tipoBase } from '@/features/portals/adPlan';
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
  /** Tipo deste imóvel quando a tela abriu: a cota do servidor já o conta. */
  tipoInicial: string | null;
  salvando: boolean;
}

interface Props {
  imovel: Property;
  modo: 'passo' | 'cartao';
  aoMudarImovel: (p: Property) => void;
  aoConcluir?: () => void;
}

const mensagemDe = (err: unknown, reserva: string) => extractError(err).message || reserva;

// Tipo desconhecido do catálogo conta no base (é o que o servidor faz).
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
  const [salvandoMarca, setSalvandoMarca] = useState<Marca | null>(null);
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
          const vazio = { portal, pubs: [], ids: [], featuredIds: [], tipoInicial: null, salvando: false };
          try {
            const d = await portalsService.get(portal.portal_key);
            const tipos = portal.ad_types ?? [];
            const pubs = d.publications ?? [];
            const meu = pubs.find(p => p.property_id === imovel.id);
            return {
              ...vazio, erro: false, pubs,
              ids: d.property_ids ?? [], featuredIds: d.featured_property_ids ?? [],
              tipoInicial: tipoEfetivo(tipos, meu?.ad_type),
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
    setSalvandoMarca(campo);
    try {
      aoMudarImovel(await propertiesService.update(imovel.id, { [campo]: valor }));
    } catch (err) {
      setMarcas(m => ({ ...m, [campo]: anterior }));
      toast.error(mensagemDe(err, 'Não foi possível salvar. Tente de novo.'));
    } finally {
      setSalvandoMarca(null);
    }
  };

  const mexer = (key: string, patch: Partial<EstadoDoPortal>) =>
    setEstados(prev => prev && prev.map(e => (e.portal.portal_key === key ? { ...e, ...patch } : e)));

  // `proximo` é o tipo novo deste imóvel; nulo = tirar do portal.
  const gravar = async (e: EstadoDoPortal, proximo: string | null) => {
    const key = e.portal.portal_key;
    const legado = !temTiposDeAnuncio(e.portal);
    const antes = { pubs: e.pubs, ids: e.ids, featuredIds: e.featuredIds };
    const outras = e.pubs.filter(p => p.property_id !== imovel.id);
    const pubs = proximo === null ? outras : [...outras, { property_id: imovel.id, ad_type: proximo }];
    const ids = proximo === null ? e.ids.filter(i => i !== imovel.id) : [...new Set([...e.ids, imovel.id])];
    const featuredIds = e.featuredIds.filter(i => i !== imovel.id);
    mexer(key, legado ? { ids, featuredIds, salvando: true } : { pubs, salvando: true });
    try {
      if (legado) await portalsService.updatePublicationsLegacy(key, ids, featuredIds);
      else await portalsService.updatePublications(key, pubs, {});
      mexer(key, { salvando: false });
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

  const linhaDoPortal = (e: EstadoDoPortal) => {
    const { portal } = e;
    const tipos = portal.ad_types ?? [];
    const legado = !temTiposDeAnuncio(portal);
    const meu = e.pubs.find(p => p.property_id === imovel.id);
    const ligado = legado ? e.ids.includes(imovel.id) : !!meu;
    const atual = tipoEfetivo(tipos, meu?.ad_type);
    const tipoAtual = tipos.find(t => t.key === atual);
    // A cota do servidor já conta este imóvel no tipo em que a tela abriu.
    const contar = (t: PortalAdType) =>
      t.count + (atual === t.key ? 1 : 0) - (e.tipoInicial === t.key ? 1 : 0);
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
                  disabled={e.salvando}
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
              disabled={e.salvando}
              onCheckedChange={v => gravar(e, v ? (tipoBase(tipos)?.key ?? 'standard') : null)}
            />
          </>
        )}
      </div>
    );
  };

  const MARCAS: { campo: Marca; rotulo: string }[] = [
    { campo: 'published_on_site', rotulo: 'Publicar no site' },
    { campo: 'ai_enabled', rotulo: 'IA Vendedora pode oferecer' },
    { campo: 'featured', rotulo: 'Destaque' },
  ];

  return (
    <div className="mt-4 space-y-4">
      {modo === 'passo' && (
        <div>
          <h1 className="text-2xl font-bold leading-tight">Onde divulgar</h1>
          <p className="mt-1 text-sm text-muted-foreground">{imovel.title}</p>
        </div>
      )}
      <div className="space-y-3">
        {MARCAS.map(({ campo, rotulo }) => (
          <div key={campo} className="flex items-center justify-between gap-3">
            <span className="text-sm">{rotulo}</span>
            <Switch
              aria-label={rotulo}
              checked={marcas[campo]}
              disabled={salvandoMarca === campo}
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
          <p className="pt-3 text-sm text-muted-foreground">Nenhum portal conectado. {linkIntegracoes}</p>
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
