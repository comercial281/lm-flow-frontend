// "Avisar os clientes" — manda no WhatsApp dos grupos dos clientes que saiu
// aula nova, pela instância operacional da Leal Mídia. Só o super-admin vê.
//
// O texto tem VARIÁVEIS dentro ({aula}, {link}...) e continua assim até o
// envio: cada grupo recebe o link da aula no endereço da imobiliária dele, e um
// texto já montado aqui mandaria todo mundo para o app de um cliente só. Por
// isso a prévia também vem do servidor — é ele quem monta a mensagem de verdade.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, X, Send, Loader2, Check, Users, RefreshCw, Save, AlertTriangle, Search, History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  academyAnnouncementsService,
  type AnnounceConfig,
  type AnnounceHistoryEntry,
  type AnnounceLesson,
  type AnnounceResult,
  type AvailableGroup,
  type CentralInstance,
} from '@/services/academy/academyAnnouncementsService';

interface Props {
  lesson: AnnounceLesson;
  courseId: string;
  onClose: () => void;
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AnnounceLessonModal({ lesson, courseId, onClose }: Props) {
  const path = `/academia/curso/${courseId}?lesson=${lesson.id}`;

  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<AnnounceConfig | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [instancia, setInstancia] = useState('');
  const [instancias, setInstancias] = useState<CentralInstance[]>([]);
  const [grupos, setGrupos] = useState<AvailableGroup[]>([]);
  const [buscandoGrupos, setBuscandoGrupos] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [previa, setPrevia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resultados, setResultados] = useState<AnnounceResult[] | null>(null);
  const [historico, setHistorico] = useState<AnnounceHistoryEntry[]>([]);
  const [verHistorico, setVerHistorico] = useState(false);

  // Aviso já dado para ESTA aula — evita o cliente receber duas vezes.
  const jaAvisada = useMemo(
    () => historico.find((h) => h.lesson_id === lesson.id && h.sent > 0),
    [historico, lesson.id],
  );

  const carregarGrupos = useCallback(async (nomeInstancia?: string) => {
    setBuscandoGrupos(true);
    try {
      const r = await academyAnnouncementsService.groups(nomeInstancia);
      setGrupos(r.data.data ?? []);
    } catch {
      toast.error('Não deu para ler os grupos do WhatsApp agora.');
    } finally {
      setBuscandoGrupos(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cfg, inst] = await Promise.all([
          academyAnnouncementsService.config(),
          academyAnnouncementsService.instances().catch(() => ({ data: { data: [] as CentralInstance[] } })),
        ]);
        if (!vivo) return;
        const dados = cfg.data.data;
        setConfig(dados);
        setMensagem(dados.template);
        setInstancia(dados.instance);
        setEscolhidos(dados.groups.map((g) => g.jid));
        setHistorico(dados.history ?? []);
        setInstancias(inst.data.data ?? []);
        await carregarGrupos(dados.instance);
      } catch {
        if (vivo) toast.error('Não deu para abrir o aviso de aula nova.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [carregarGrupos]);

  // Prévia do texto final, montada pelo servidor. Espera a digitação parar.
  useEffect(() => {
    if (!mensagem.trim()) {
      setPrevia('');
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const r = await academyAnnouncementsService.preview({ message: mensagem, lesson, path });
        setPrevia(r.data.data.text);
      } catch {
        setPrevia('');
      }
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return grupos;
    return grupos.filter(
      (g) => g.name.toLowerCase().includes(termo) || (g.client ?? '').toLowerCase().includes(termo),
    );
  }, [grupos, busca]);

  const selecionados = useMemo(
    () => grupos.filter((g) => escolhidos.includes(g.jid)),
    [grupos, escolhidos],
  );

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((g) => escolhidos.includes(g.jid));

  function alternar(jid: string) {
    setEscolhidos((atual) => (atual.includes(jid) ? atual.filter((x) => x !== jid) : [...atual, jid]));
  }

  function alternarTodos() {
    const jids = visiveis.map((g) => g.jid);
    setEscolhidos((atual) =>
      todosVisiveisMarcados ? atual.filter((x) => !jids.includes(x)) : [...new Set([...atual, ...jids])],
    );
  }

  async function trocarInstancia(nome: string) {
    setInstancia(nome);
    await carregarGrupos(nome);
  }

  async function salvarPadrao() {
    setSalvando(true);
    try {
      const r = await academyAnnouncementsService.saveConfig({
        template: mensagem,
        instance: instancia,
        groups: selecionados.map((g) => ({ jid: g.jid, name: g.name })),
      });
      setConfig(r.data.data);
      toast.success('Texto, remetente e grupos salvos como padrão.');
    } catch {
      toast.error('Não deu para salvar o padrão.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setResultados(null);
    try {
      const r = await academyAnnouncementsService.send({
        message: mensagem,
        instance: instancia,
        groups: selecionados.map((g) => ({ jid: g.jid, name: g.name })),
        lesson,
        path,
      });
      const dados = r.data.data;
      setResultados(dados.results ?? []);
      if (dados.sent === dados.total) toast.success(`Aviso enviado para ${dados.sent} grupo(s).`);
      else toast.warning(`Enviado para ${dados.sent} de ${dados.total} grupo(s).`);
      const cfg = await academyAnnouncementsService.config();
      setHistorico(cfg.data.data.history ?? []);
    } catch (e) {
      const erro = e as { response?: { data?: { error?: string } } };
      toast.error(erro.response?.data?.error ?? 'Não deu para enviar o aviso.');
    } finally {
      setEnviando(false);
    }
  }

  const resultadoDe = (jid: string) => resultados?.find((r) => r.jid === jid);
  const desativado = config ? !config.enabled : false;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-start gap-2.5 min-w-0">
            <Megaphone size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold">Avisar os clientes sobre esta aula</h2>
              <p className="text-xs text-muted-foreground truncate">{lesson.titulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {carregando ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary" size={22} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {desativado && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs">
                <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                <span>O aviso de aula nova está desligado. Ligue de novo para conseguir enviar.</span>
              </div>
            )}

            {jaAvisada && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Esta aula já foi avisada em <strong>{formatarData(jaAvisada.at)}</strong> para{' '}
                  {jaAvisada.sent} grupo(s). Enviar de novo faz o cliente receber duas vezes.
                </span>
              </div>
            )}

            {/* Mensagem */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="aviso-mensagem">Mensagem</label>
              <textarea
                id="aviso-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg text-xs bg-background border border-border outline-none focus:border-primary/50 resize-y font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Trechos entre chaves são preenchidos na hora do envio:{' '}
                {(config?.variables ?? []).map((v) => `{${v}}`).join(' · ')}. O{' '}
                <strong>{'{link}'}</strong> abre a aula no endereço da imobiliária que recebe.
              </p>
            </div>

            {/* Prévia */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Como vai chegar no grupo</p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap min-h-[64px]">
                {previa || <span className="text-muted-foreground">Escreva a mensagem para ver a prévia.</span>}
              </div>
            </div>

            {/* Remetente */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="aviso-instancia">Enviar pelo número</label>
              <select
                id="aviso-instancia"
                value={instancia}
                onChange={(e) => trocarInstancia(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-background border border-border outline-none focus:border-primary/50"
              >
                {instancias.length === 0 && <option value={instancia}>{instancia}</option>}
                {instancias.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} {i.connected ? '· conectado' : '· fora do ar'}
                  </option>
                ))}
              </select>
            </div>

            {/* Grupos */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Users size={13} /> Grupos que vão receber ({selecionados.length} de {grupos.length})
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={alternarTodos} className="text-[11px] text-primary hover:underline" type="button">
                    {todosVisiveisMarcados ? 'Desmarcar' : 'Marcar'} os da lista
                  </button>
                  <button
                    onClick={() => carregarGrupos(instancia)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    type="button"
                  >
                    <RefreshCw size={11} className={buscandoGrupos ? 'animate-spin' : ''} /> Atualizar
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Procurar grupo ou cliente"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-background border border-border outline-none focus:border-primary/50"
                />
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {visiveis.map((g) => {
                  const marcado = escolhidos.includes(g.jid);
                  const res = resultadoDe(g.jid);
                  return (
                    <button
                      key={g.jid}
                      onClick={() => alternar(g.jid)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${marcado ? 'bg-primary/5' : ''}`}
                      type="button"
                    >
                      <span
                        className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border ${
                          marcado ? 'bg-primary border-primary' : 'border-border'
                        }`}
                      >
                        {marcado && <Check size={11} className="text-primary-foreground" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs truncate">{g.name}</span>
                        {g.client && (
                          <span className="block text-[10px] text-muted-foreground truncate">
                            Cliente: {g.client}
                          </span>
                        )}
                      </span>
                      {res && (
                        <span className={`text-[10px] shrink-0 ${res.sent ? 'text-emerald-500' : 'text-red-500'}`}>
                          {res.sent ? 'enviado' : `falhou (${res.http ?? '—'})`}
                        </span>
                      )}
                    </button>
                  );
                })}
                {visiveis.length === 0 && (
                  <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                    {buscandoGrupos ? 'Procurando os grupos...' : 'Nenhum grupo encontrado neste número.'}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A lista vem do próprio WhatsApp do número escolhido. Onde o grupo já está cadastrado
                no cliente, o nome da imobiliária aparece embaixo.
              </p>
            </div>

            {/* Histórico */}
            <div>
              <button
                onClick={() => setVerHistorico((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                type="button"
              >
                <History size={12} /> {verHistorico ? 'Esconder' : 'Ver'} os últimos avisos ({historico.length})
              </button>
              {verHistorico && (
                <div className="mt-2 space-y-1.5">
                  {historico.map((h) => (
                    <div key={`${h.at}-${h.lesson_id}`} className="rounded-lg border border-border px-3 py-2 text-[11px]">
                      <p className="font-medium truncate">{h.titulo || 'Aula sem título'}</p>
                      <p className="text-muted-foreground">
                        {formatarData(h.at)} · {h.sent} de {h.total} grupo(s) · {h.by}
                      </p>
                    </div>
                  ))}
                  {historico.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nenhum aviso enviado ainda.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={salvarPadrao}
            disabled={salvando || carregando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-40"
            type="button"
          >
            {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar como padrão
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground" type="button">
              Fechar
            </button>
            <button
              onClick={enviar}
              disabled={enviando || carregando || desativado || selecionados.length === 0 || !mensagem.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
              type="button"
            >
              {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar para {selecionados.length} grupo(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
