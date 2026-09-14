import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import { Star, Search } from 'lucide-react';
import {
  propertiesService,
  Property,
  TRANSACTION_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import {
  portalsService,
  PortalAdType,
  PortalPublication,
} from '@/services/portals/portalsService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { extractError } from '@/utils/apiHelpers';
import {
  LEGADO_BASE,
  LEGADO_DESTAQUE,
  Estouro,
  contarPorTipo,
  estouros,
  estourosDoErro,
  mensagemDeEstouro,
  tipoBase,
} from '@/features/portals/adPlan';

interface Props {
  portalKey: string;
  /** Tipos de anúncio do portal, na ordem do servidor (o primeiro é o base). Vazio = servidor antigo. */
  adTypes: PortalAdType[];
  initialPublications: PortalPublication[];
  /** Modo legado (sem `adTypes`): a estrela de destaque de sempre. */
  supportsHighlight: boolean;
  onSaved?: () => void;
}

/**
 * Seleção de quais imóveis vão pro portal e em que TIPO DE ANÚNCIO cada um sai.
 *
 * O estado é um mapa imóvel → tipo. Com mais de um tipo o imóvel marcado ganha
 * um seletor; com um tipo só não há o que escolher. Sem tipos (servidor antigo)
 * vale a estrela de destaque, e o envio vai no formato legado.
 *
 * A cota de cada tipo é do plano do portal (o card *Plano de anúncios*). Estourar
 * NÃO trava: o contador fica vermelho, o *Salvar* continua habilitado, e o clique
 * abre "tem certeza?" com os tipos estourados — decisão do dono (2026-09-14). O
 * servidor faz a mesma conta e recusa com 422 sem a confirmação; quando as
 * contagens divergem (outra aba mexeu), o 422 abre o MESMO diálogo com as linhas
 * dele e reenvia confirmado.
 */
export default function PortalPropertiesSelector({
  portalKey,
  adTypes,
  initialPublications,
  supportsHighlight,
  onSaved,
}: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [properties, setProperties] = useState<Property[]>([]);
  const [publications, setPublications] = useState<Map<string, string>>(
    () => new Map(initialPublications.map(p => [p.property_id, p.ad_type])),
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const modoLegado = adTypes.length === 0;
  const base = modoLegado ? LEGADO_BASE : (tipoBase(adTypes)?.key ?? LEGADO_BASE);
  const comSeletor = adTypes.length > 1;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await propertiesService.list({ status: 'active', per_page: 500 });
      setProperties(res.data ?? []);
    } catch {
      // Leitura de fundo não grita: a lista mostra o aviso no lugar dos imóveis.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setPublications(new Map(initialPublications.map(p => [p.property_id, p.ad_type])));
  }, [initialPublications]);

  const counts = useMemo(() => contarPorTipo(adTypes, publications), [adTypes, publications]);
  const estourosLocais = useMemo(() => estouros(adTypes, counts), [adTypes, counts]);
  const emDestaque = useMemo(
    () => [...publications.values()].filter(t => t === LEGADO_DESTAQUE).length,
    [publications],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.address_neighborhood ?? '').toLowerCase().includes(q) ||
      (p.address_city ?? '').toLowerCase().includes(q));
  }, [properties, search]);

  const toggle = (id: string) => {
    setPublications(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, base);
      return next;
    });
  };

  const setAdType = (id: string, adType: string) => {
    setPublications(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, adType);
      return next;
    });
  };

  const toggleFeatured = (id: string) => {
    setPublications(prev => {
      const atual = prev.get(id);
      if (atual === undefined) return prev;
      const next = new Map(prev);
      next.set(id, atual === LEGADO_DESTAQUE ? LEGADO_BASE : LEGADO_DESTAQUE);
      return next;
    });
  };

  // Quem já estava marcado mantém o tipo; quem entra agora entra no base.
  const selectAll = () => {
    setPublications(prev => {
      const next = new Map(prev);
      properties.forEach(p => { if (!next.has(p.id)) next.set(p.id, base); });
      return next;
    });
  };

  const dialogoDeEstouro = (lista: Estouro[]) => confirmar({
    titulo: 'Plano de anúncios estourado',
    descricao: (
      <span className="block space-y-2">
        <span className="block space-y-1">
          {lista.map(e => (
            <span key={e.key} className="block">{mensagemDeEstouro([e])}</span>
          ))}
        </span>
        <span className="block">O portal rebaixa os que sobrarem para o tipo abaixo. Salvar mesmo assim?</span>
      </span>
    ),
    rotuloDaAcao: 'Salvar mesmo assim',
    destrutivo: true,
  });

  const enviar = async (pubs: PortalPublication[], confirmOverflow: boolean) => {
    setSaving(true);
    try {
      await portalsService.updatePublications(portalKey, pubs, { confirmOverflow });
      toast.success('Publicações atualizadas');
      onSaved?.();
    } catch (err) {
      // As contagens do servidor podem ter divergido das da tela (outra aba
      // mexeu no plano ou nos imóveis): o 422 traz as linhas DELE, e a pergunta
      // é a mesma. Já confirmado, não pergunta de novo — vira erro.
      const doServidor = estourosDoErro(err);
      if (doServidor.length > 0 && !confirmOverflow) {
        setSaving(false);
        if (await dialogoDeEstouro(doServidor)) await enviar(pubs, true);
        return;
      }
      toast.error(extractError(err).message || 'Erro ao salvar publicações');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (modoLegado) {
      setSaving(true);
      try {
        const ids = [...publications.keys()];
        const featuredIds = ids.filter(id => publications.get(id) === LEGADO_DESTAQUE);
        await portalsService.updatePublicationsLegacy(portalKey, ids, featuredIds);
        toast.success('Publicações atualizadas');
        onSaved?.();
      } catch (err) {
        toast.error(extractError(err).message || 'Erro ao salvar publicações');
      } finally {
        setSaving(false);
      }
      return;
    }

    const pubs: PortalPublication[] = [...publications].map(([property_id, ad_type]) => ({ property_id, ad_type }));
    let confirmOverflow = false;
    if (estourosLocais.length > 0) {
      if (!(await dialogoDeEstouro(estourosLocais))) return;
      confirmOverflow = true;
    }
    await enviar(pubs, confirmOverflow);
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-sm">Imóveis publicados neste portal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {publications.size} selecionado(s)
            {modoLegado && supportsHighlight ? ` · ${emDestaque} em destaque` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="text-xs" onClick={selectAll}>Selecionar todos</Button>
          <Button variant="outline" className="text-xs" onClick={() => setPublications(new Map())}>
            Limpar
          </Button>
          <Button className="text-xs" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar publicações'}
          </Button>
        </div>
      </div>

      {!modoLegado && (
        // Sempre visível: ver a cota antes de estourar é o que faz a regra
        // parecer regra, e não castigo.
        <div className="flex flex-wrap items-center gap-2" data-testid="contadores-por-tipo">
          {adTypes.map(t => {
            const count = counts[t.key] ?? 0;
            const estourou = t.limit !== null && t.limit !== undefined && count > t.limit;
            return (
              <span
                key={t.key}
                data-testid={`contador-${t.key}`}
                title={estourou ? 'Acima da cota do plano — o portal rebaixa os que sobrarem' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  estourou
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'bg-muted/40 text-foreground'
                }`}
              >
                {t.label}
                <span className={estourou ? 'font-bold' : 'text-muted-foreground'}>
                  {t.limit === null || t.limit === undefined ? count : `${count} / ${t.limit}`}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por código, título, bairro ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando imóveis...</div>
      ) : loadFailed ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar os imóveis agora. Recarregue a página para tentar de novo.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum imóvel ativo encontrado. Cadastre imóveis com status Ativo para publicá-los.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y rounded-lg border">
          {filtered.map(p => {
            const adType = publications.get(p.id);
            const isSelected = adType !== undefined;
            const isFeatured = adType === LEGADO_DESTAQUE;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <input
                  type="checkbox"
                  aria-label={`Publicar ${p.code}`}
                  checked={isSelected}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 accent-primary shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle(p.id)}>
                  <p className="text-sm font-medium truncate">
                    <span className="text-muted-foreground font-mono text-xs mr-2">{p.code}</span>
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {TRANSACTION_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
                    {p.display_price ? ` · ${p.display_price}` : ''}
                    {p.address_neighborhood ? ` · ${p.address_neighborhood}` : ''}
                    {p.address_city ? `, ${p.address_city}` : ''}
                  </p>
                </div>
                {comSeletor && isSelected && (
                  <div className="w-36 sm:w-44 shrink-0">
                    <NativeSelect
                      aria-label={`Tipo de anúncio de ${p.code}`}
                      value={adType}
                      onChange={e => setAdType(p.id, e.target.value)}
                    >
                      {adTypes.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                {modoLegado && supportsHighlight && (
                  <button
                    type="button"
                    title={isFeatured ? 'Remover destaque' : 'Destacar neste portal'}
                    onClick={() => toggleFeatured(p.id)}
                    disabled={!isSelected}
                    className={`shrink-0 p-1.5 rounded-md transition-colors ${
                      isFeatured
                        ? 'text-amber-500'
                        : isSelected
                          ? 'text-muted-foreground hover:text-amber-500'
                          : 'text-muted-foreground/30 cursor-not-allowed'
                    }`}
                  >
                    <Star className="h-4 w-4" fill={isFeatured ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
