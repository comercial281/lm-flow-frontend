import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase, Building2, Search, Trash2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Textarea } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { visitsService, type LeadPickerItem, type PersonRef } from '@/services/visits/visitsService';
import { propertiesService } from '@/services/properties/propertiesService';
import { useAuthStore } from '@/store/authStore';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { cn } from '@/lib/utils';
import AgendaDoDia from './AgendaDoDia';
import { DURACOES_DA_TAREFA, PRIORIDADES, TEXTOS_DE_TAREFAS as T } from './textos';
import { iconeDaCategoria } from './iconeDaCategoria';
import { useCategoriasDeTarefa } from './useCategoriasDeTarefa';
import { juntarDataEHora, proximaHoraCheia, separarDataEHora } from './prazos';
import { motivoDoErro, tarefasService } from './tarefasService';
import { useEhGestor } from './useEhGestor';
import type { ContextoDaTarefa, DadosDaTarefa, ImovelDaTarefa, Prioridade, TarefaAtividade } from './tipos';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  aoSalvar: (t: TarefaAtividade) => void;
  /** Edição: a tarefa como veio da lista. */
  tarefa?: TarefaAtividade | null;
  /** Criar num card conhecido (aba do card, seção da Conversa). */
  pipelineItemId?: string | null;
  /** Atividades: escolher o lead antes (o servidor acha o card dele). */
  escolherLead?: boolean;
  /** Id da categoria da lista (a da tarefa concluída, na "próxima tarefa"). */
  categoriaInicial?: string;
}

// Tarefa antiga que só guarda o nome (sem id): não dá pra mandar id, então fica como está.
const SO_NOME = '__so_nome__';
const DURACAO_PADRAO = 60;

const dois = (n: number) => String(n).padStart(2, '0');
/** Horas de 15 em 15 minutos; a da tarefa entra mesmo fora da grade. */
const HORAS = Array.from({ length: 96 }, (_, i) => `${dois(Math.floor(i / 4))}:${dois((i % 4) * 15)}`);
/** 90 → "01h30", como no campo Duração. */
const rotuloDaDuracao = (min: number) => `${dois(Math.floor(min / 60))}h${dois(min % 60)}`;

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

function Iniciais({ nome, className }: { nome: string; className?: string }) {
  return (
    <span aria-hidden className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary', className)}>
      {iniciais(nome)}
    </span>
  );
}

/**
 * "Agendar tarefa" (08/10/2026, modelo pedido pelo dono a partir do sistema que
 * a Nova 27 usava): tipo em botões, título, prioridade, data/hora/duração,
 * responsável, vínculos (lead, atendimento, imóvel), observação e, à direita,
 * a agenda do dia do responsável. Mesma janela pra criar e editar, nos três
 * lugares (card, Conversa, tela Tarefas).
 * Spec: LM FLOW/specs/2026-10-08-janela-da-tarefa-design.md.
 *
 * Regras que vêm de antes (Frente 2, 07/10): só o gestor troca o responsável
 * (o servidor só aceita dele); ao editar, campo que a pessoa não mexeu não vai
 * pro servidor; categoria da tarefa que saiu da lista continua aparecendo.
 */
export default function JanelaDaTarefa({ aberta, aoFechar, aoSalvar, tarefa, pipelineItemId, escolherLead, categoriaInicial }: Props) {
  const ehGestor = useEhGestor();
  const eu = useAuthStore(s => s.currentUser);
  const { ativas, todas, carregando } = useCategoriasDeTarefa();

  const [titulo, setTitulo] = useState('');
  // Título que a janela preencheu com o nome do tipo: trocar o tipo troca o título junto.
  const tituloAuto = useRef('');
  // null = a pessoa ainda não mexeu: criar usa a padrão; editar mantém a atual (e não manda nada).
  const [escolha, setEscolha] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>('low');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [duracao, setDuracao] = useState(DURACAO_PADRAO);
  const [pessoas, setPessoas] = useState<PersonRef[]>([]);
  const [responsavel, setResponsavel] = useState('');
  // Quem já era o responsável ao abrir (o da tarefa, ou o do lead): igual a ele = não manda.
  const [responsavelInicial, setResponsavelInicial] = useState('');
  const [observacao, setObservacao] = useState('');
  const [imovel, setImovel] = useState<ImovelDaTarefa | null>(null);
  const [imovelMexido, setImovelMexido] = useState(false);
  const [buscandoImovel, setBuscandoImovel] = useState(false);
  const [busca, setBusca] = useState('');
  const [leads, setLeads] = useState<LeadPickerItem[]>([]);
  const [lead, setLead] = useState<LeadPickerItem | null>(null);
  const [contexto, setContexto] = useState<ContextoDaTarefa | null>(null);
  const [semCard, setSemCard] = useState(false);
  const [concluida, setConcluida] = useState(false);
  const [diaDaAgenda, setDiaDaAgenda] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const base = tarefa?.due_at ? separarDataEHora(tarefa.due_at) : proximaHoraCheia();
    setTitulo(tarefa?.title ?? '');
    tituloAuto.current = '';
    setEscolha(null);
    setPrioridade(tarefa?.priority ?? 'low');
    setData(base.data);
    setHora(base.hora);
    setDuracao(tarefa?.duration_minutes ?? DURACAO_PADRAO);
    setResponsavel(tarefa?.assignee?.id ?? '');
    setResponsavelInicial(tarefa?.assignee?.id ?? '');
    setObservacao(tarefa?.description ?? '');
    setImovel(tarefa?.property ?? null);
    setImovelMexido(false);
    setBuscandoImovel(false);
    setLead(null);
    setBusca('');
    setContexto(null);
    setSemCard(false);
    setConcluida(false);
    setDiaDaAgenda(base.data);
    setErro(null);
    visitsService.realtors().then(setPessoas).catch(() => setPessoas([]));
  }, [aberta, tarefa, categoriaInicial]);

  // Lead, atendimento e responsável do lead: do card (criar pelo card, editar) ou do lead escolhido.
  const cardConhecido = tarefa?.pipeline_item_id ?? pipelineItemId ?? null;
  useEffect(() => {
    if (!aberta) return;
    const alvo = cardConhecido ? { pipeline_item_id: cardConhecido } : lead ? { contact_id: lead.id } : null;
    if (!alvo) return;
    let vivo = true;
    setSemCard(false);
    tarefasService
      .contexto(alvo)
      .then(c => {
        if (!vivo) return;
        setContexto(c);
        // Criar: o responsável do lead já aparece escolhido (é quem o servidor usaria).
        const dono = c.owner;
        if (!tarefa && dono) {
          setResponsavel(r => r || dono.id);
          setResponsavelInicial(r => r || dono.id);
        }
      })
      .catch(e => {
        if (!vivo) return;
        setContexto(null);
        if (motivoDoErro(e) === 'lead_sem_card') setSemCard(true);
      });
    return () => { vivo = false; };
  }, [aberta, cardConhecido, lead, tarefa]);

  useEffect(() => {
    if (!aberta || !escolherLead || lead) return;
    const id = window.setTimeout(() => {
      visitsService.leadPickerPage(busca, 1, 8).then(r => setLeads(r.data)).catch(() => setLeads([]));
    }, 300);
    return () => window.clearTimeout(id);
  }, [aberta, escolherLead, busca, lead]);

  const idDaTarefa = tarefa?.category_option_id ?? (tarefa?.category ? SO_NOME : '');
  const padrao = ativas.find(o => o.id === categoriaInicial)?.id ?? ativas[0]?.id ?? '';
  const categoria = escolha ?? (tarefa ? idDaTarefa : padrao);
  // Categoria da tarefa que não está entre as ativas continua aparecendo, pra não sumir.
  const atual = tarefa && idDaTarefa && !ativas.some(o => o.id === idDaTarefa)
    ? { valor: idDaTarefa, rotulo: `${todas.find(o => o.id === idDaTarefa)?.label ?? tarefa.category ?? ''}${todas.find(o => o.id === idDaTarefa)?.active === false ? ' (arquivada)' : ''}` }
    : null;

  // Criar: o título nasce com o nome do tipo padrão (dá pra trocar). Roda depois
  // do efeito que limpa a janela ao abrir; a forma com função enxerga o título já
  // limpo (o valor desta renderização ainda seria o da vez anterior).
  const nomeDoPadrao = ativas.find(o => o.id === padrao)?.label ?? '';
  useEffect(() => {
    if (!aberta || tarefa || carregando || !nomeDoPadrao) return;
    setTitulo(t => {
      if (t) return t;
      tituloAuto.current = nomeDoPadrao;
      return nomeDoPadrao;
    });
  }, [aberta, tarefa, carregando, nomeDoPadrao]);

  const escolherTipo = (id: string) => {
    setEscolha(id);
    const nome = ativas.find(o => o.id === id)?.label ?? '';
    if (!titulo.trim() || titulo === tituloAuto.current) {
      setTitulo(nome);
      tituloAuto.current = nome;
    }
  };

  const mudarData = (valor: string) => {
    setData(valor);
    if (valor) setDiaDaAgenda(valor);
  };

  const horas = useMemo(() => (hora && !HORAS.includes(hora) ? [...HORAS, hora].sort() : HORAS), [hora]);
  const duracoes = useMemo<number[]>(
    () => ((DURACOES_DA_TAREFA as readonly number[]).includes(duracao) ? [...DURACOES_DA_TAREFA] : [...DURACOES_DA_TAREFA, duracao].sort((a, b) => a - b)),
    [duracao],
  );

  const nomeDe = (id: string) =>
    pessoas.find(p => p.id === id)?.name
    ?? (tarefa?.assignee?.id === id ? tarefa.assignee.name : contexto?.owner?.id === id ? contexto.owner.name : '');
  const podeEscolherResponsavel = ehGestor && pessoas.length > 0;
  const meuNome = eu?.available_name ?? eu?.name ?? '';
  const nomeDoResponsavel = tarefa?.assignee?.name ?? meuNome;
  const donoDaAgenda = podeEscolherResponsavel
    ? (responsavel ? { id: responsavel, name: nomeDe(responsavel) } : null)
    : tarefa?.assignee ?? (eu ? { id: eu.id, name: meuNome } : null);

  const nomeDoLead = contexto?.contact?.name ?? tarefa?.contact?.name ?? lead?.name ?? '';

  const salvar = async () => {
    if (!titulo.trim()) return setErro(T.faltaTitulo);
    if (!data) return setErro(T.faltaData);
    if (!hora) return setErro(T.faltaHora);
    if (escolherLead && !lead && !tarefa) return setErro(T.faltaLead);
    setErro(null);
    setSalvando(true);
    const mudouResponsavel = ehGestor && responsavel && responsavel !== responsavelInicial;
    const dados: DadosDaTarefa = {
      title: titulo.trim(),
      // Criar: a escolhida/padrão (vazio = sem categoria). Editar: só se a pessoa mexeu ('' limpa).
      ...(tarefa ? (escolha !== null ? { category_option_id: escolha } : {}) : (categoria ? { category_option_id: categoria } : {})),
      due_date: juntarDataEHora(data, hora),
      // Editar com o campo vazio manda '' pro servidor limpar; criar só omite.
      description: observacao.trim() || (tarefa ? '' : undefined),
      ...(!tarefa || prioridade !== (tarefa.priority ?? 'low') ? { priority: prioridade } : {}),
      ...(!tarefa || duracao !== (tarefa.duration_minutes ?? DURACAO_PADRAO) ? { duration_minutes: duracao } : {}),
      ...(tarefa ? (imovelMexido ? { property_id: imovel?.id ?? '' } : {}) : (imovel ? { property_id: imovel.id } : {})),
      ...(mudouResponsavel ? { assigned_to_id: responsavel } : {}),
    };
    try {
      let salva = tarefa
        ? await tarefasService.editar(tarefa.id, dados)
        : await tarefasService.criar({
          ...dados,
          ...(concluida ? { completed: true } : {}),
          ...(lead ? { contact_id: lead.id } : { pipeline_item_id: pipelineItemId ?? undefined }),
        });
      if (tarefa && concluida) salva = await tarefasService.concluir(tarefa.id);
      toast.success(concluida ? T.concluida : tarefa ? T.salva : T.criada);
      aoSalvar(salva);
      aoFechar();
    } catch (e) {
      toast.error(motivoDoErro(e) === 'lead_sem_card' ? T.semCardAtividades : apiErrorMessage(e, T.erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={v => !v && aoFechar()}>
      <DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa ? T.editarTarefa : T.agendarTarefa}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="grid min-w-0 content-start gap-5">
            {/* Tipo de tarefa */}
            <div className="grid gap-2">
              <Label id="tarefa-tipo">{T.tipoDeTarefa}</Label>
              {ativas.length === 0 && !atual && !carregando ? (
                <p className="text-sm text-muted-foreground">{T.semCategoriasCadastradas}</p>
              ) : (
                <div role="group" aria-labelledby="tarefa-tipo" className="flex gap-2 overflow-x-auto pb-1">
                  {atual && (
                    <Button type="button" size="sm" variant={categoria === atual.valor ? 'default' : 'outline'} aria-pressed={categoria === atual.valor} className="shrink-0" onClick={() => setEscolha(null)}>
                      {atual.rotulo}
                    </Button>
                  )}
                  {ativas.map(o => {
                    const Icone = iconeDaCategoria(o.label);
                    const ligado = categoria === o.id;
                    return (
                      <Button key={o.id} type="button" size="sm" variant={ligado ? 'default' : 'outline'} aria-pressed={ligado} className="shrink-0" onClick={() => escolherTipo(o.id)}>
                        <Icone className="mr-1.5 h-4 w-4" />
                        {o.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Título + prioridade */}
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
              <div className="grid gap-1">
                <Label htmlFor="tarefa-titulo">{T.tituloDaTarefa}</Label>
                <Input id="tarefa-titulo" value={titulo} maxLength={255} onChange={e => setTitulo(e.target.value)} placeholder={T.exemploDeTitulo} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="tarefa-prioridade">{T.prioridade}</Label>
                <Seletor id="tarefa-prioridade" value={prioridade} onChange={e => setPrioridade(e.target.value as Prioridade)}>
                  {PRIORIDADES.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                  {prioridade === 'urgent' && <option value="urgent">Urgente</option>}
                </Seletor>
              </div>
            </div>

            {/* Data, hora, duração */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="tarefa-data">{T.data}</Label>
                <Input id="tarefa-data" type="date" value={data} onChange={e => mudarData(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="tarefa-hora">{T.hora}</Label>
                <Seletor id="tarefa-hora" value={hora} onChange={e => setHora(e.target.value)}>
                  {!hora && <option value="">--:--</option>}
                  {horas.map(h => <option key={h} value={h}>{h}</option>)}
                </Seletor>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="tarefa-duracao">{T.duracao}</Label>
                <Seletor id="tarefa-duracao" value={String(duracao)} onChange={e => setDuracao(Number(e.target.value))}>
                  {duracoes.map(d => <option key={d} value={String(d)}>{rotuloDaDuracao(d)}</option>)}
                </Seletor>
              </div>
            </div>

            {/* Corretor responsável: só o gestor troca */}
            <div className="grid gap-1">
              <Label htmlFor="tarefa-responsavel">{T.corretorResponsavel}</Label>
              {podeEscolherResponsavel ? (
                <Seletor id="tarefa-responsavel" value={responsavel} onChange={e => setResponsavel(e.target.value)}>
                  {!responsavel && <option value="">{T.responsavelDoLead}</option>}
                  {responsavel && !pessoas.some(p => p.id === responsavel) && <option value={responsavel}>{nomeDe(responsavel) || T.manterResponsavel}</option>}
                  {pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Seletor>
              ) : (
                <div id="tarefa-responsavel" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Iniciais nome={nomeDoResponsavel} className="h-7 w-7" />
                  <span className="truncate font-medium">{nomeDoResponsavel}</span>
                </div>
              )}
            </div>

            {/* Vincular */}
            <div className="grid gap-2">
              <Label id="tarefa-vincular">{T.vincular}</Label>
              {buscandoImovel ? (
                <BuscaDeImovel aoEscolher={p => { setImovel(p); setImovelMexido(true); setBuscandoImovel(false); }} aoDesistir={() => setBuscandoImovel(false)} />
              ) : (
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setBuscandoImovel(true)}>
                    <Building2 className="mr-1.5 h-4 w-4" />
                    {imovel ? T.trocarImovel : T.imovel}
                  </Button>
                </div>
              )}

              <div role="group" aria-labelledby="tarefa-vincular" className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
                {escolherLead && !tarefa && !lead ? (
                  <div className="grid gap-1">
                    <Label htmlFor="tarefa-lead">{T.lead}</Label>
                    <Input id="tarefa-lead" value={busca} onChange={e => setBusca(e.target.value)} placeholder={T.buscarLead} />
                    <ul className="max-h-40 overflow-y-auto">
                      {leads.map(l => (
                        <li key={l.id}>
                          <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setLead(l)}>
                            {l.name}
                            {l.phone_number && <span className="ml-2 text-xs text-muted-foreground">{l.phone_number}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : nomeDoLead ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                    <Iniciais nome={nomeDoLead} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nomeDoLead}</p>
                      <p className="text-xs text-muted-foreground">{T.contato}</p>
                    </div>
                    {escolherLead && !tarefa && lead && (
                      <button type="button" className="text-xs text-primary" onClick={() => { setLead(null); setContexto(null); setSemCard(false); }}>{T.trocar}</button>
                    )}
                  </div>
                ) : null}

                {semCard && <p className="text-sm text-destructive">{T.semCardAtividades}</p>}

                {contexto && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{[T.atendimento, contexto.pipeline_name].filter(Boolean).join(' · ')}</p>
                      <p className="truncate text-xs text-primary">{contexto.contact?.name}</p>
                    </div>
                  </div>
                )}

                {imovel && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{imovel.title}</p>
                      <p className="text-xs text-muted-foreground">{imovel.code}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={T.tirarImovel} onClick={() => { setImovel(null); setImovelMexido(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Observação */}
            <div className="grid gap-1">
              <Label htmlFor="tarefa-observacao">{T.observacao}</Label>
              <Textarea id="tarefa-observacao" rows={3} value={observacao} onChange={e => setObservacao(e.target.value)} />
              <p className="text-xs text-muted-foreground">{T.observacaoDica}</p>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <AgendaDoDia className="hidden md:flex" dia={diaDaAgenda} aoMudarDia={setDiaDaAgenda} responsavel={donoDaAgenda} />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={concluida} onChange={e => setConcluida(e.target.checked)} />
            {T.marcarConcluida}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={aoFechar} disabled={salvando}>{T.cancelar}</Button>
            <Button onClick={salvar} disabled={salvando || carregando}>{T.salvar}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Busca no catálogo de imóveis (título ou código), como no Agendar visita. */
function BuscaDeImovel({ aoEscolher, aoDesistir }: { aoEscolher: (p: ImovelDaTarefa) => void; aoDesistir: () => void }) {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<ImovelDaTarefa[] | null>(null);

  useEffect(() => {
    if (!texto.trim()) { setLista(null); return; }
    let vivo = true;
    const id = window.setTimeout(() => {
      propertiesService
        .list({ q: texto, per_page: 8 })
        .then(r => { if (vivo) setLista((r.data ?? []).map(p => ({ id: String(p.id), title: p.title, code: p.code }))); })
        .catch(() => { if (vivo) setLista([]); });
    }, 300);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [texto]);

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus aria-label={T.imovel} value={texto} onChange={e => setTexto(e.target.value)} placeholder={T.buscarImovel} className="pl-9" />
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={aoDesistir}>{T.cancelar}</Button>
      </div>
      {lista && (
        lista.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">{T.nenhumImovel}</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
            {lista.map(p => (
              <li key={p.id}>
                <button type="button" className="w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50" onClick={() => aoEscolher(p)}>
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
