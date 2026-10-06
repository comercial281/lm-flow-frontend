import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Bot, Building2, ChevronDown, ChevronUp, FileText, Globe, LayoutTemplate, Loader2, Plus, X,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import IconActionButton from '@/components/base/IconActionButton';
import { CampoTexto } from '@/components/base/Campo';
import { plural } from '@/lib/formato';
import { cn } from '@/lib/utils';
import {
  conflitoDaOrigem,
  mensagemDoServidor,
  roletaConfigService,
  type NovaOrigem,
  type RoletaOrigin,
  type RoletaOriginKind,
  type RoletaOriginOption,
} from '@/services/roletaConfig/roletaConfigService';
import { formulariosQuePega, origemTexto } from '../roletaNovaTextos';

// ── DE ONDE VEM O LEAD (roleta nova, D2/D3/D9) ──────────────────────────────
//
// A roleta é disparada por ORIGENS: formulário do Meta (exato ou "nome contém"),
// IA Vendedora, landing, portal e site. WhatsApp e anúncio que abre o WhatsApp
// ficam fora (D3). Uma origem fica numa roleta só: escolher aqui um item que
// está em outra roleta pergunta antes e tira de lá.
//
// Tirar e adicionar valem na hora (é lista, não formulário). Depois de cada
// mudança a lista volta do servidor: mover uma origem mexe em duas roletas, e a
// verdade sobre quem pega o quê é dele.

const ICONE_DO_TIPO: Record<RoletaOriginKind, LucideIcon> = {
  meta_form: FileText,
  meta_form_keyword: FileText,
  sales_agent: Bot,
  landing: LayoutTemplate,
  portal_sale: Building2,
  portal_rent: Building2,
  site_sale: Globe,
  site_rent: Globe,
};

type TipoDeOrigem = 'meta' | 'sales_agent' | 'landing' | 'portal' | 'site';

const TIPOS: { chave: TipoDeOrigem; rotulo: string; descricao: string; kinds: RoletaOriginKind[]; icone: LucideIcon; vazio: string }[] = [
  { chave: 'meta', rotulo: 'Formulário do Meta', descricao: 'Lead Ads do Facebook e do Instagram', kinds: ['meta_form'], icone: FileText, vazio: 'Nenhum formulário do Meta ainda.' },
  { chave: 'sales_agent', rotulo: 'IA Vendedora', descricao: 'Quando a IA passa o lead pra um corretor', kinds: ['sales_agent'], icone: Bot, vazio: 'Nenhuma IA Vendedora ainda.' },
  { chave: 'landing', rotulo: 'Landing', descricao: 'O formulário das páginas de anúncio', kinds: ['landing'], icone: LayoutTemplate, vazio: 'Nenhuma landing ainda.' },
  { chave: 'portal', rotulo: 'Portal', descricao: 'Os leads dos portais de imóveis', kinds: ['portal_sale', 'portal_rent'], icone: Building2, vazio: 'Nenhum portal ligado ainda.' },
  { chave: 'site', rotulo: 'Site', descricao: 'Os formulários do seu site', kinds: ['site_sale', 'site_rent'], icone: Globe, vazio: 'O site ainda não está no ar.' },
];

/** O item como aparece na lista do passo 2 (sem o tipo, que já está no título). */
function textoDoItem(o: { kind: RoletaOriginKind; label: string }): string {
  if (o.kind === 'portal_sale' || o.kind === 'site_sale') return `${o.label} (venda)`;
  if (o.kind === 'portal_rent' || o.kind === 'site_rent') return `${o.label} (locação)`;
  return o.label;
}

const mesmaOrigem = (a: { kind: string; ref_id: string }, b: { kind: string; ref_id: string }) =>
  a.kind === b.kind && a.ref_id === b.ref_id;

function LinhaDaOrigem({ origem, aoTirar, tirando }: { origem: RoletaOrigin; aoTirar: () => void; tirando: boolean }) {
  const [aberta, setAberta] = useState(false);
  const Icone = ICONE_DO_TIPO[origem.kind] ?? FileText;
  const texto = origemTexto(origem);
  const pega = origem.matches ?? [];
  return (
    <li className="rounded-lg border border-border px-4 py-3">
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{texto}</p>
          {origem.detail && <p className="mt-0.5 text-sm text-muted-foreground">{origem.detail}</p>}
          {origem.kind === 'meta_form_keyword' && (
            <button
              type="button"
              onClick={() => setAberta(a => !a)}
              aria-expanded={aberta}
              disabled={pega.length === 0}
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {pega.length === 0 ? 'não pega nenhum formulário hoje' : `pega ${plural(pega.length, 'formulário', 'formulários')} hoje`}
              {pega.length > 0 && (aberta ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />)}
            </button>
          )}
          {aberta && pega.length > 0 && (
            <ul className="mt-2 space-y-1 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              {pega.map(f => <li key={f.form_id}>{f.form_name}</li>)}
            </ul>
          )}
        </div>
        <IconActionButton
          label={`Tirar a origem ${texto}`}
          variant="ghost"
          onClick={aoTirar}
          disabled={tirando}
          icon={tirando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        />
      </div>
    </li>
  );
}

interface DialogoProps {
  aberto: boolean;
  aoFechar: () => void;
  roletaId: string;
  origens: RoletaOrigin[];
  aoAdicionar: () => Promise<void> | void;
}

// Declarado no escopo do módulo (armadilha 9 do Seletor: componente declarado
// dentro do render é outro a cada redesenho e desmonta o que está aberto).
function AdicionarOrigem({ aberto, aoFechar, roletaId, origens, aoAdicionar }: DialogoProps) {
  const [tipo, setTipo] = useState<TipoDeOrigem | null>(null);
  const [opcoes, setOpcoes] = useState<RoletaOriginOption[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [pelaPalavra, setPelaPalavra] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [trazer, setTrazer] = useState<RoletaOriginOption | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setTipo(null); setPelaPalavra(false); setPalavra(''); setTrazer(null); setErro('');
    let vivo = true;
    setOpcoes(null);
    setErroAoCarregar(false);
    roletaConfigService.getOriginOptions()
      .then(o => { if (vivo) setOpcoes(o); })
      .catch(() => { if (vivo) setErroAoCarregar(true); });
    return () => { vivo = false; };
  }, [aberto]);

  const definicao = TIPOS.find(t => t.chave === tipo) ?? null;
  const itens = useMemo(
    () => (definicao ? (opcoes ?? []).filter(o => definicao.kinds.includes(o.kind)) : []),
    [definicao, opcoes],
  );
  const formularios = useMemo(() => (opcoes ?? []).filter(o => o.kind === 'meta_form'), [opcoes]);
  const pegaHoje = useMemo(() => formulariosQuePega(palavra, formularios), [palavra, formularios]);

  const adicionar = async (origem: NovaOrigem) => {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await roletaConfigService.addOrigin(roletaId, origem);
      toast.success('Origem adicionada');
      await aoAdicionar();
      aoFechar();
    } catch (e) {
      const conflito = conflitoDaOrigem(e);
      setErro(
        conflito
          ? `O formulário "${conflito.form_name}" já é pego por outra regra "nome contém", na roleta ${conflito.roleta_name}. Use uma palavra que não pegue ele, ou escolha o formulário exato.`
          : mensagemDoServidor(e) ?? 'Não deu pra adicionar a origem. Tente de novo.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const escolher = (op: RoletaOriginOption) => {
    if (op.roleta_config_id && op.roleta_config_id !== roletaId) { setTrazer(op); setErro(''); return; }
    void adicionar({ kind: op.kind as Exclude<RoletaOriginKind, 'meta_form_keyword'>, ref_id: op.ref_id });
  };

  const conteudo = () => {
    if (erroAoCarregar) return <p role="alert" className="text-sm text-destructive">Não deu pra carregar as origens. Feche e tente de novo.</p>;
    if (!opcoes) {
      return (
        <div className="flex justify-center py-8 text-muted-foreground" role="status" aria-label="Carregando as origens">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      );
    }
    if (!definicao) {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPOS.map(t => (
            <button
              key={t.chave}
              type="button"
              onClick={() => setTipo(t.chave)}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <t.icone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{t.rotulo}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {definicao.chave === 'meta' && (
          <div role="radiogroup" aria-label="Como escolher o formulário" className="flex flex-wrap gap-2">
            <Button type="button" role="radio" aria-checked={!pelaPalavra} variant={!pelaPalavra ? 'default' : 'outline'} onClick={() => { setPelaPalavra(false); setErro(''); }}>
              Um formulário
            </Button>
            <Button type="button" role="radio" aria-checked={pelaPalavra} variant={pelaPalavra ? 'default' : 'outline'} onClick={() => { setPelaPalavra(true); setTrazer(null); setErro(''); }}>
              Pelo nome do formulário
            </Button>
          </div>
        )}

        {pelaPalavra ? (
          <form
            className="space-y-4"
            onSubmit={e => { e.preventDefault(); if (palavra.trim()) void adicionar({ kind: 'meta_form_keyword', keyword: palavra.trim() }); }}
          >
            <CampoTexto
              id="origem-palavra"
              rotulo="O nome do formulário contém"
              placeholder="Ex.: ALMA"
              valor={palavra}
              aoMudar={v => { setPalavra(v); setErro(''); }}
              ajuda="Formulário novo com essa palavra no nome entra sozinho. O formulário escolhido pelo nome exato vence esta regra."
            />
            {palavra.trim() && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm" aria-live="polite">
                {pegaHoje.length === 0 ? (
                  <p className="text-muted-foreground">Não pega nenhum formulário hoje.</p>
                ) : (
                  <>
                    <p className="font-medium">Pega {plural(pegaHoje.length, 'formulário', 'formulários')} hoje:</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {pegaHoje.map(f => <li key={f.ref_id}>{f.label}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
            <Button type="submit" disabled={!palavra.trim() || salvando}>{salvando ? 'Adicionando…' : 'Adicionar'}</Button>
          </form>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{definicao.vazio}</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {itens.map(op => {
              const nesta = op.roleta_config_id === roletaId || origens.some(o => mesmaOrigem(o, op));
              const emOutra = !nesta && !!op.roleta_config_id;
              return (
                <li key={`${op.kind}:${op.ref_id}`}>
                  <button
                    type="button"
                    disabled={nesta || salvando}
                    onClick={() => escolher(op)}
                    className={cn(
                      'w-full rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
                      trazer && mesmaOrigem(trazer, op) && 'border-primary bg-primary/5',
                    )}
                  >
                    <span className="block text-sm font-medium">{textoDoItem(op)}</span>
                    {op.detail && <span className="mt-0.5 block text-sm text-muted-foreground">{op.detail}</span>}
                    {nesta && <span className="mt-1 block text-sm text-muted-foreground">Já está nesta roleta</span>}
                    {emOutra && <span className="mt-1 block text-sm text-amber-700 dark:text-amber-400">Está na roleta {op.roleta_name}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {trazer && (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-medium">Trazer pra esta roleta?</p>
            <p className="text-sm text-muted-foreground">
              "{textoDoItem(trazer)}" sai da roleta {trazer.roleta_name} e os leads dela passam a entrar aqui.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setTrazer(null)} disabled={salvando}>Deixar onde está</Button>
              <Button
                type="button"
                disabled={salvando}
                onClick={() => void adicionar({ kind: trazer.kind as Exclude<RoletaOriginKind, 'meta_form_keyword'>, ref_id: trazer.ref_id })}
              >
                {salvando ? 'Trazendo…' : 'Trazer'}
              </Button>
            </div>
          </div>
        )}

        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </div>
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={a => { if (!a && !salvando) aoFechar(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{definicao ? definicao.rotulo : 'Adicionar origem'}</DialogTitle>
          <DialogDescription>
            {definicao ? 'Escolha de onde vêm os leads desta roleta.' : 'De onde vêm os leads que esta roleta distribui?'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">{conteudo()}</div>
        <DialogFooter className="sm:justify-between">
          {definicao ? (
            <Button type="button" variant="ghost" onClick={() => { setTipo(null); setPelaPalavra(false); setTrazer(null); setErro(''); }} disabled={salvando}>
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Voltar
            </Button>
          ) : <span />}
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  roletaId: string;
  origens: RoletaOrigin[];
  /** Busca a lista de novo no servidor (depois de tirar ou adicionar). */
  recarregar: () => Promise<void>;
}

export default function OrigensBloco({ roletaId, origens, recarregar }: Props) {
  const [adicionando, setAdicionando] = useState(false);
  const [tirando, setTirando] = useState<string | null>(null);

  const tirar = async (o: RoletaOrigin) => {
    if (tirando) return;
    setTirando(`${o.kind}:${o.ref_id}`);
    try {
      await roletaConfigService.removeOrigin(roletaId, { kind: o.kind, ref_id: o.ref_id });
      toast.success('Origem tirada da roleta');
      await recarregar();
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra tirar a origem. Tente de novo.');
    } finally {
      setTirando(null);
    }
  };

  return (
    <div className="space-y-4">
      {origens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          Nenhuma origem ainda. Sem origem, a roleta não recebe lead.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Origens desta roleta">
          {origens.map(o => (
            <LinhaDaOrigem
              key={`${o.kind}:${o.ref_id}`}
              origem={o}
              tirando={tirando === `${o.kind}:${o.ref_id}`}
              aoTirar={() => void tirar(o)}
            />
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => setAdicionando(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Adicionar origem
      </Button>
      <AdicionarOrigem
        aberto={adicionando}
        aoFechar={() => setAdicionando(false)}
        roletaId={roletaId}
        origens={origens}
        aoAdicionar={recarregar}
      />
    </div>
  );
}
