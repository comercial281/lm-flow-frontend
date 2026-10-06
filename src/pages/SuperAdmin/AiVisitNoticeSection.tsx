import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarCheck, ChevronDown, ChevronRight, Loader2, RotateCcw, Send,
} from 'lucide-react';
import { Button, Checkbox, Input, Label, Textarea } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import {
  aiVisitNoticeService,
  type AiVisitNoticeClient,
  type AiVisitNoticeConfig,
  type AiVisitNoticeGroups,
} from '@/services/superAdmin/aiVisitNoticeService';
import { CORPO_SECAO, ESQUELETO, SECAO, SELO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { groupLine, HINT_SEM_MARCA } from './aiVisitNoticeGroups';

/**
 * AVISO DE VISITA DA IA NO GRUPO DO CLIENTE.
 *
 * Quando a IA Vendedora marca (ou remarca) uma visita, cai uma mensagem no grupo
 * que a Leal Mídia tem com aquela imobiliária — o mesmo do relatório da semana e
 * do aviso de aula nova —, pelo número operacional da Leal Mídia.
 *
 * Duas escolhas do dono do produto que a tela precisa deixar claras:
 *
 *   • Só as visitas que a IA marcou avisam. Quem marca à mão no CRM não dispara
 *     nada, e é isso que mantém o grupo limpo.
 *   • Nasce DESLIGADO em toda imobiliária, e liga-se uma a uma. A mensagem cai
 *     num grupo com gente de verdade dentro e não há como desfazer um disparo.
 *
 * ⚠️ A lista de clientes vem SEM os grupos: descobrir em qual grupo o aviso
 * cairia é uma conversa com o WhatsApp mais uma varredura no banco daquele
 * cliente, e fazer isso para trinta e uma imobiliárias de uma vez não cabe numa
 * requisição — a resposta voltaria sem motivo nenhum dentro, que é a falha que
 * este produto já diagnosticou errado duas vezes. Por isso o grupo de cada
 * cliente só é buscado quando alguém abre aquela linha.
 *
 * 06/10/2026: liga/desliga por imobiliária é a `Chave` da casa (vira na hora,
 * volta sozinha se o servidor recusar). As regras de 21/09 continuam: nasce
 * desligado, lista sem grupo, ligar relê o destino, teste respeita a chave,
 * grava só a imobiliária que mudou.
 */

const TOM: Record<'client' | 'internal' | 'neutral', string> = {
  client: 'border-primary/30 bg-primary/10 text-primary',
  internal: 'bg-muted text-foreground',
  neutral: 'bg-muted text-muted-foreground',
};

// Os dois formatos de erro da API: o padrão traz `error.message`, e a recusa
// por cargo traz `error` como TEXTO com a explicação em `message`. Ler só o
// primeiro faz a recusa virar frase genérica e manda procurar no lugar errado.
function motivo(e: unknown, reserva: string): string {
  const r = (e as { response?: { data?: { error?: unknown; message?: string } } }).response?.data;
  return (
    (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
    (typeof r?.error === 'string' ? r.error : null) ||
    r?.message ||
    reserva
  );
}

export default function AiVisitNoticeSection() {
  const [cfg, setCfg] = useState<AiVisitNoticeConfig | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [salvandoTexto, setSalvandoTexto] = useState(false);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Record<string, AiVisitNoticeGroups>>({});
  const [carregandoGrupos, setCarregandoGrupos] = useState<string | null>(null);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  // `silencioso`: re-sincroniza depois de uma gravação que falhou, sem esqueleto.
  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado('carregando');
    try {
      const data = await aiVisitNoticeService.load();
      setCfg(data);
      setTexto(data.template);
      setErro(null);
      setEstado('pronto');
    } catch (e) {
      setErro(motivo(e, 'Não consegui carregar a configuração do aviso agora.'));
      setCfg(null);
      setEstado('erro');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const carregarGrupos = useCallback(async (schema: string) => {
    setCarregandoGrupos(schema);
    try {
      const data = await aiVisitNoticeService.groups(schema);
      setGrupos(prev => ({ ...prev, [schema]: data }));
    } catch (e) {
      toast.error(motivo(e, 'Não consegui listar os grupos dessa imobiliária.'));
    } finally {
      setCarregandoGrupos(null);
    }
  }, []);

  const abrir = (schema: string) => {
    const proximo = aberto === schema ? null : schema;
    setAberto(proximo);
    if (proximo && !grupos[proximo]) void carregarGrupos(proximo);
  };

  /**
   * ⚠️ Manda SÓ a imobiliária que mudou. O servidor mescla por cliente; mandar o
   * mapa inteiro apagaria a imobiliária criada depois de esta tela abrir, em
   * silêncio — a armadilha da janela *Destino do lead* da landing.
   * O erro sobe para quem chamou (a Chave volta sozinha e avisa).
   */
  const gravarCliente = async (cliente: AiVisitNoticeClient, patch: Partial<AiVisitNoticeClient>) => {
    const enabled = patch.enabled ?? cliente.enabled;
    const groupJids = patch.group_jids ?? cliente.group_jids;
    setMexendo(cliente.schema);
    try {
      const data = await aiVisitNoticeService.save({
        tenants: { [cliente.schema]: { enabled, group_jids: groupJids } },
      });
      setCfg(data);
      // Ligar sem saber para onde vai é o pior desfecho aqui: relê o destino na
      // hora, para o motivo aparecer junto com a chave virando.
      if (enabled) void carregarGrupos(cliente.schema);
    } finally {
      setMexendo(null);
    }
  };

  const marcarGrupo = async (cliente: AiVisitNoticeClient, jids: string[]) => {
    try {
      await gravarCliente(cliente, { group_jids: jids });
    } catch (e) {
      toast.error(motivo(e, 'Não consegui salvar.'));
      void load(true);
    }
  };

  const salvarTexto = async () => {
    setSalvandoTexto(true);
    try {
      const data = await aiVisitNoticeService.save({ template: texto });
      setCfg(data);
      setTexto(data.template);
      toast.success('Texto salvo — vale para todas as imobiliárias ligadas.');
    } catch (e) {
      toast.error(motivo(e, 'Não consegui salvar o texto.'));
    } finally {
      setSalvandoTexto(false);
    }
  };

  const testar = async (schema: string) => {
    setTestando(schema);
    try {
      const r = await aiVisitNoticeService.test(schema);
      toast.success(`Teste enviado em ${r.sent} de ${r.total} ${r.total === 1 ? 'grupo' : 'grupos'}.`);
    } catch (e) {
      toast.error(motivo(e, 'O teste não saiu.'));
    } finally {
      setTestando(null);
    }
  };

  const clientes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = cfg?.clients ?? [];
    if (!termo) return lista;
    return lista.filter(c => `${c.name} ${c.slug}`.toLowerCase().includes(termo));
  }, [cfg, busca]);

  const ligados = (cfg?.clients ?? []).filter(c => c.enabled).length;
  const textoMudou = !!cfg && texto.trim() !== cfg.template.trim();
  const ehPadrao = !!cfg && cfg.template.trim() === cfg.default_template.trim();

  return (
    <section aria-labelledby="aviso-de-visita" className={SECAO}>
      <h2 id="aviso-de-visita" className={`flex items-center gap-2 ${TITULO_SECAO}`}>
        <CalendarCheck className="h-4 w-4" aria-hidden="true" /> Aviso de visita da IA
      </h2>
      <p className={SUBTITULO_SECAO}>
        Quando a IA Vendedora marca ou remarca uma visita, cai uma mensagem no grupo que temos com
        aquela imobiliária, pelo número operacional. Visita que o corretor marca à mão não avisa
        nada. Nasce desligado: ligue imobiliária por imobiliária.
      </p>

      {estado === 'carregando' && <div aria-busy="true" className={`${CORPO_SECAO} h-40 ${ESQUELETO}`} />}

      {estado === 'erro' && (
        <EmptyState
          tipo="erro"
          title="Não deu pra carregar o aviso de visita"
          description={erro ?? undefined}
          aoTentarDeNovo={() => void load()}
        />
      )}

      {estado === 'pronto' && cfg && (
        <>
          {/* ── A mensagem ─────────────────────────────────────────────── */}
          <div className={`${CORPO_SECAO} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="aviso-texto" className="text-xs font-semibold">Como a mensagem chega no grupo</Label>
              {!ehPadrao && (
                <Button type="button" variant="ghost" size="sm" disabled={salvandoTexto} onClick={() => setTexto(cfg.default_template)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Voltar ao padrão
                </Button>
              )}
            </div>
            <Textarea
              id="aviso-texto"
              value={texto}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(e.target.value)}
              rows={9}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Os trechos entre chaves são preenchidos na hora do envio:{' '}
              <span className="font-mono">{cfg.vars.map(v => `{${v}}`).join(' ')}</span>. As que
              começam em <span className="font-mono">linha_</span> já trazem o rótulo e somem
              inteiras quando o lead não tem aquele dado — use-as para não deixar linha em branco.
              O telefone do lead existe como variável e fica fora do texto padrão de propósito: o
              grupo é compartilhado conosco.
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" disabled={!textoMudou || salvandoTexto} onClick={() => void salvarTexto()}>
                {salvandoTexto && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Salvar texto
              </Button>
              {textoMudou && <span className="text-[11px] text-muted-foreground">alterações não salvas</span>}
            </div>
          </div>

          {/* ── Quem recebe ────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold">
                Imobiliárias ({ligados} de {cfg.clients.length} {cfg.clients.length === 1 ? 'ligada' : 'ligadas'})
              </p>
              {cfg.clients.length > 0 && (
                <Input
                  type="search"
                  aria-label="Buscar imobiliária"
                  value={busca}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
                  placeholder="Buscar imobiliária…"
                  className="h-8 max-w-[220px] text-xs"
                />
              )}
            </div>

            {cfg.clients.length === 0 ? (
              <EmptyState title="Nenhuma imobiliária ainda" description="Quando houver cliente ativo, ele aparece aqui, desligado." />
            ) : clientes.length === 0 ? (
              <EmptyState tipo="semResultado" aoLimparFiltros={() => setBusca('')} />
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {clientes.map(cliente => {
                  const info = grupos[cliente.schema];
                  const estaAberto = aberto === cliente.schema;
                  return (
                    <div key={cliente.schema} className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-expanded={estaAberto}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => abrir(cliente.schema)}
                        >
                          {estaAberto
                            ? <ChevronDown className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
                            : <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />}
                          <span className="truncate text-sm font-medium">{cliente.name}</span>
                        </button>
                        <Chave
                          rotulo={`Aviso de visita de ${cliente.name}`}
                          semRotuloVisivel
                          ligada={cliente.enabled}
                          desabilitada={mexendo === cliente.schema}
                          aoMudar={v => gravarCliente(cliente, { enabled: v })}
                        />
                      </div>

                      {estaAberto && (
                        <div className="mt-3 flex flex-col gap-2 pl-6">
                          {carregandoGrupos === cliente.schema && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Procurando o grupo desta imobiliária…
                            </p>
                          )}

                          {info && info.reason && (
                            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-[11px] text-foreground">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive" aria-hidden="true" />
                              {info.reason}
                            </p>
                          )}

                          {info && info.groups.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              {info.groups.map(g => {
                                const escolhido = cliente.group_jids.includes(g.jid);
                                const usado = info.selected.includes(g.jid);
                                const linha = groupLine(g);
                                return (
                                  <label key={g.jid} className="flex items-start gap-2 text-xs">
                                    <Checkbox
                                      className="mt-0.5"
                                      aria-label={g.name}
                                      checked={escolhido}
                                      disabled={mexendo === cliente.schema}
                                      onCheckedChange={v => {
                                        const jids = v === true
                                          ? [...cliente.group_jids, g.jid]
                                          : cliente.group_jids.filter(j => j !== g.jid);
                                        void marcarGrupo(cliente, jids);
                                      }}
                                    />
                                    <span className="min-w-0">
                                      <span className="font-medium">{g.name}</span>
                                      <span className={`ml-1.5 ${SELO} ${TOM[linha.tone]}`}>{linha.badge}</span>
                                      {usado && !escolhido && (
                                        <span className="ml-1.5 text-muted-foreground">— é para cá que o aviso sai hoje</span>
                                      )}
                                      {linha.note && <span className="mt-0.5 block text-[11px] text-muted-foreground">{linha.note}</span>}
                                    </span>
                                  </label>
                                );
                              })}
                              <p className="text-[11px] text-muted-foreground">{HINT_SEM_MARCA}</p>
                            </div>
                          )}

                          {info && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                type="button" variant="outline" size="sm"
                                disabled={testando === cliente.schema}
                                onClick={() => void testar(cliente.schema)}
                              >
                                {testando === cliente.schema
                                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  : <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                                Mandar um teste
                              </Button>
                              <span className="text-[11px] text-muted-foreground">Cai no grupo de verdade, marcado como teste.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── O que já saiu ──────────────────────────────────────────── */}
          <div className="mt-6">
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => setVerHistorico(v => !v)}
            >
              {verHistorico ? 'Esconder os últimos avisos' : `Ver os últimos avisos (${cfg.history.length})`}
            </button>
            {verHistorico && (
              <div className="mt-2 flex flex-col gap-1">
                {cfg.history.length === 0 && <p className="text-xs text-muted-foreground">Nenhum aviso saiu ainda.</p>}
                {cfg.history.map((h, i) => (
                  <div key={`${h.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className="text-muted-foreground">{h.at ? new Date(h.at).toLocaleString('pt-BR') : '—'}</span>
                    <span className="font-medium">{h.schema}</span>
                    <span>a IA {h.acao} visita de {h.lead} para {h.quando}</span>
                    <span className={h.sent ? 'text-foreground' : 'text-destructive'}>{h.sent}/{h.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
