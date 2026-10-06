import { useEffect, useMemo, useRef, useState } from 'react';
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
  type RoletaKeywordPreview,
  type RoletaOriginOption,
} from '@/services/roletaConfig/roletaConfigService';
import { metaPagesService } from '@/services/integrations/metaPagesService';
import { Seletor } from '@/components/base/Seletor';
import { Campo } from '@/components/base/Campo';
import { origemTexto } from '../roletaNovaTextos';

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
  /** Recarrega a lista (não lança: a falha é avisada por quem passa). */
  aoAdicionar: () => Promise<void> | void;
}

/** A frase do conflito da barreira D9 (na prévia e na recusa ao salvar). */
function fraseDoConflito(c: { form_name: string; roleta_name: string }): string {
  return `O formulário "${c.form_name}" já é pego por outra regra "nome contém", na roleta ${c.roleta_name}. Use uma palavra que não pegue ele, ou escolha o formulário exato.`;
}

/** Espera de digitação antes de pedir a prévia ao servidor. */
const ESPERA_DA_PREVIA_MS = 400;

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
  // Páginas do Facebook do cliente: com mais de uma, a regra "nome contém" diz
  // de qual página (sem isso o servidor usa a principal e o gestor nem sabe).
  const [paginas, setPaginas] = useState<{ id: string; nome: string }[]>([]);
  const [pagina, setPagina] = useState('');
  const [previa, setPrevia] = useState<RoletaKeywordPreview | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [previaFalhou, setPreviaFalhou] = useState(false);
  const pedidoDaPrevia = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    metaPagesService.getAll()
      .then(lista => {
        if (!vivo) return;
        const ativas = lista.filter(p => p.is_active).map(p => ({ id: p.id, nome: p.page_name || p.page_id || 'Página' }));
        setPaginas(ativas);
        setPagina(atual => atual || ativas[0]?.id || '');
      })
      .catch(() => { if (vivo) setPaginas([]); });
    return () => { vivo = false; };
  }, [aberto]);

  // Prévia do servidor (mesma regra do roteador), com espera de digitação.
  // Resposta velha (de uma palavra anterior) é descartada pelo contador.
  const palavraLimpa = palavra.trim();
  const paginaEnviada = paginas.length > 1 ? pagina : '';
  useEffect(() => {
    const pedido = ++pedidoDaPrevia.current;
    setPreviaFalhou(false);
    if (!pelaPalavra || !palavraLimpa) { setPrevia(null); setConferindo(false); return; }
    setConferindo(true);
    const t = setTimeout(() => {
      roletaConfigService.getKeywordPreview(palavraLimpa, paginaEnviada || null)
        .then(p => { if (pedido === pedidoDaPrevia.current) setPrevia(p); })
        .catch(() => { if (pedido === pedidoDaPrevia.current) { setPrevia(null); setPreviaFalhou(true); } })
        .finally(() => { if (pedido === pedidoDaPrevia.current) setConferindo(false); });
    }, ESPERA_DA_PREVIA_MS);
    return () => clearTimeout(t);
  }, [pelaPalavra, palavraLimpa, paginaEnviada]);

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

  const adicionar = async (origem: NovaOrigem) => {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await roletaConfigService.addOrigin(roletaId, origem);
    } catch (e) {
      const conflito = conflitoDaOrigem(e);
      setErro(conflito ? fraseDoConflito(conflito) : mensagemDoServidor(e) ?? 'Não deu pra adicionar a origem. Tente de novo.');
      setSalvando(false);
      return;
    }
    // Gravou: fecha e avisa, mesmo que a lista não volte (a falha da recarga é
    // avisada à parte, com "Tentar de novo"; não é "não deu pra adicionar").
    setSalvando(false);
    toast.success('Origem adicionada');
    aoFechar();
    await aoAdicionar();
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
            onSubmit={e => {
              e.preventDefault();
              if (!palavraLimpa || previa?.conflict) return;
              void adicionar({ kind: 'meta_form_keyword', keyword: palavraLimpa, ...(paginaEnviada ? { meta_page_id: paginaEnviada } : {}) });
            }}
          >
            {paginas.length > 1 && (
              <Campo id="origem-pagina" rotulo="Página do Facebook">
                <Seletor id="origem-pagina" value={pagina} onChange={e => { setPagina(e.target.value); setErro(''); }} className="w-full sm:w-80">
                  {paginas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Seletor>
              </Campo>
            )}
            <CampoTexto
              id="origem-palavra"
              rotulo="O nome do formulário contém"
              placeholder="Ex.: ALMA"
              valor={palavra}
              aoMudar={v => { setPalavra(v); setErro(''); }}
              ajuda="Formulário novo com essa palavra no nome entra sozinho. O formulário escolhido pelo nome exato vence esta regra."
            />
            {palavraLimpa && (
              <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm" aria-live="polite">
                {conferindo ? (
                  <p className="text-muted-foreground">Conferindo quais formulários ela pega…</p>
                ) : previaFalhou ? (
                  <p className="text-muted-foreground">Não deu pra conferir agora. Ao adicionar, a regra é conferida de novo.</p>
                ) : previa && previa.matches.length === 0 ? (
                  <p className="text-muted-foreground">Não pega nenhum formulário hoje.</p>
                ) : previa ? (
                  <>
                    <p className="font-medium">Pega {plural(previa.matches.length, 'formulário', 'formulários')} hoje:</p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {previa.matches.map(f => <li key={f.form_id}>{f.form_name}</li>)}
                    </ul>
                  </>
                ) : null}
                {!conferindo && previa?.conflict && (
                  <p className="font-medium text-destructive">{fraseDoConflito(previa.conflict)}</p>
                )}
              </div>
            )}
            <Button type="submit" disabled={!palavraLimpa || salvando || conferindo || !!previa?.conflict}>
              {salvando ? 'Adicionando…' : 'Adicionar'}
            </Button>
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

const AVISO_LISTA_DESATUALIZADA = 'Salvo, mas não deu pra atualizar a lista.';

export default function OrigensBloco({ roletaId, origens, recarregar }: Props) {
  const [adicionando, setAdicionando] = useState(false);
  const [tirando, setTirando] = useState<string | null>(null);

  // A gravação já deu certo: se só a recarga falhar, avisa à parte e oferece
  // tentar de novo (nunca "não deu pra adicionar/tirar" em cima de um sucesso).
  const recarregarComAviso = async (): Promise<void> => {
    try {
      await recarregar();
    } catch {
      toast.error(AVISO_LISTA_DESATUALIZADA, {
        action: { label: 'Tentar de novo', onClick: () => void recarregarComAviso() },
      });
    }
  };

  const tirar = async (o: RoletaOrigin) => {
    if (tirando) return;
    setTirando(`${o.kind}:${o.ref_id}`);
    try {
      await roletaConfigService.removeOrigin(roletaId, { kind: o.kind, ref_id: o.ref_id });
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra tirar a origem. Tente de novo.');
      setTirando(null);
      return;
    }
    toast.success('Origem tirada da roleta');
    await recarregarComAviso();
    setTirando(null);
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
        aoAdicionar={recarregarComAviso}
      />
    </div>
  );
}
