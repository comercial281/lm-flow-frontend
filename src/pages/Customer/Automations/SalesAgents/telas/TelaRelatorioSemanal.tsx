import { useEffect, useState, useCallback } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Send, RefreshCw, Loader2, CalendarDays, Users } from 'lucide-react';
import { plural } from '@/lib/formato';
import { salesAgentsService, type WeeklyReportCheck, type WeeklyReportConfig, type WeeklyReportPayload, type WeeklyReportTargets } from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import { Seletor } from '@/components/base/Seletor';
import { WEEKDAY_OPTIONS } from './TelaSugestoes';

// ---------------- Relatórios (do CLIENTE, não da IA) ----------------

// ⚠️ Esta aba mora dentro da tela da IA, mas o relatório é do CLIENTE: ele não
// recebe `agent`, e a configuração é a mesma em qualquer IA que você abrir. Duas
// IAs no mesmo cliente fariam o gestor receber a semana duas vezes.
export default function TelaRelatorioSemanal() {
  // O tipo do serviço, e não uma cópia escrita à mão: a cópia não conhecia os campos
  // que dizem se a prévia ainda está sendo montada, e campo que a tela não conhece é
  // campo que ela ignora em silêncio.
  const [payload, setPayload] = useState<WeeklyReportPayload | null>(null);
  const [targets, setTargets] = useState<WeeklyReportTargets>({ groups: [], managers: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'send' | 'text' | null>(null);
  const [texto, setTexto] = useState('');
  // "Por que não está saindo?" — só aparece depois do clique; a conferência é cara
  // do lado do servidor (ele fala com o WhatsApp operacional para montá-la).
  const [checks, setChecks] = useState<WeeklyReportCheck[] | null>(null);
  const [checando, setChecando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dados, alvos] = await Promise.all([
        salesAgentsService.weeklyReport(),
        salesAgentsService.weeklyReportTargets().catch(() => ({ groups: [], managers: [] })),
      ]);
      setPayload(dados);
      setTargets(alvos);
      setTexto(dados.current?.text ?? '');
    } catch {
      // Leitura de fundo não grita.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // `quiet` para as marcações de destino: ali quem confirma é a própria caixinha
  // mudando de estado. Um aviso "Salvo" por clique vira cachoeira quando o gestor
  // marca meia dúzia de destinos seguidos — o mesmo motivo pelo qual a lista do
  // Bolsão não emite aviso a cada atualização de fundo. Erro continua avisando
  // sempre: aí a caixinha mente, e a pessoa precisa saber.
  const salvarConfig = async (patch: Partial<WeeklyReportConfig>, { quiet = false } = {}) => {
    try {
      const config = await salesAgentsService.saveWeeklyReportConfig(patch);
      setPayload((prev) => (prev ? { ...prev, config } : prev));
      if (!quiet) toast.success('Salvo');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  /**
   * ⚠️ O relatório JÁ VEM PRONTO desta chamada — números e tudo. O que continua em
   * segundo plano é só a REDAÇÃO da IA, e é ela que o acompanhamento espera.
   *
   * Antes o botão só "começava" e o relatório inteiro dependia do segundo plano: um
   * tropeço ali deixava o gestor sem nada na tela e sem nada explicando, que é
   * exatamente o "não consigo extrair esse relatório de maneira alguma". Não voltar
   * a esperar pelo segundo plano para ter o relatório.
   */
  const gerarPrevia = async () => {
    setBusy('preview');
    setChecks(null);
    try {
      const { report, building, preview_error: erro } = await salesAgentsService.weeklyReportPreview();

      // Os números aparecem AGORA, antes de qualquer espera.
      if (report) {
        setPayload((prev) => (prev ? { ...prev, current: report } : prev));
        setTexto(report.text ?? '');
      }

      if (!building) {
        setBusy(null);
        if (erro) toast.error(erro);
        else toast.success('Prévia gerada');
        void load();
        return;
      }

      toast.success('Números prontos. A IA está escrevendo o texto...');
      await acompanharRedacao();
    } catch (e) {
      // Sem corpo de erro = o servidor não chegou a responder. Dizer isso é o mínimo:
      // a frase antiga ("não consegui montar") mandava procurar o problema na prévia,
      // que é justamente onde ele não estava.
      toast.error(motivoDaFalha(e, 'Não consegui gerar a prévia.'));
      setBusy(null);
      void carregarDiagnostico();
    }
  };

  // Pergunta de 4 em 4 segundos até a redação sair do ar. O teto de ~2 minutos é rede
  // para o processo que morre no meio; a reserva do servidor expira sozinha em 10.
  // O relatório já está na tela esse tempo todo — aqui só se espera o texto melhorar.
  const acompanharRedacao = async () => {
    for (let tentativa = 0; tentativa < 30; tentativa += 1) {
      await new Promise((r) => setTimeout(r, 4000));

      let atual: WeeklyReportPayload | null = null;
      try {
        atual = await salesAgentsService.weeklyReport();
      } catch {
        // Oscilação de rede não cancela a redação, que segue no servidor.
      }

      if (atual) {
        setPayload(atual);
        setTexto(atual.current?.text ?? '');
        if (!atual.building) {
          setBusy(null);
          if (atual.preview_error) toast.error(atual.preview_error);
          else toast.success('Texto pronto');
          return;
        }
      }
    }
    setBusy(null);
    toast.message('A IA está demorando para escrever. O relatório com os números já está aqui — dá para editar e enviar assim mesmo.');
  };

  /**
   * ⚠️ O diagnóstico chega em DUAS levas, e isso não é refinamento: as conferências
   * de banco e configuração saem na hora, mas as duas que falam com o WhatsApp
   * operacional não cabem numa requisição — foi assim que o próprio botão falhou na
   * estreia, com a frase de reserva desta tela. Elas chegam como "conferindo" e são
   * substituídas na pergunta seguinte.
   */
  const carregarDiagnostico = async () => {
    setChecando(true);
    try {
      const primeiro = await salesAgentsService.weeklyReportDiagnostico(true);
      setChecks(primeiro.checks);
      if (primeiro.checking) await acompanharDiagnostico();
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui rodar o diagnóstico.'));
    } finally {
      setChecando(false);
    }
  };

  // Pergunta de 3 em 3 segundos até a conferência do WhatsApp chegar. O teto de ~90s
  // é rede para o processo que morre no meio; a reserva do servidor expira sozinha em
  // 3 minutos. As outras quatro linhas já estão na tela esse tempo todo.
  const acompanharDiagnostico = async () => {
    for (let tentativa = 0; tentativa < 30; tentativa += 1) {
      await new Promise((r) => setTimeout(r, 3000));

      try {
        const atual = await salesAgentsService.weeklyReportDiagnostico();
        setChecks(atual.checks);
        if (!atual.checking) return;
      } catch {
        // Oscilação de rede não cancela a conferência, que segue no servidor.
      }
    }
    setChecks((prev) =>
      (prev ?? []).map((c) =>
        c.situacao === 'pendente'
          ? { ...c, situacao: 'alerta', detalhe: 'A conferência do WhatsApp está demorando. Tente de novo em instantes.' }
          : c,
      ),
    );
  };

  const salvarTexto = async () => {
    setBusy('text');
    try {
      const report = await salesAgentsService.weeklyReportSaveText(texto);
      setPayload((prev) => (prev ? { ...prev, current: report } : prev));
      toast.success('Texto salvo');
    } catch {
      toast.error('Erro ao salvar o texto');
    } finally {
      setBusy(null);
    }
  };

  const enviar = async () => {
    setBusy('send');
    try {
      const report = await salesAgentsService.weeklyReportSendNow();
      setPayload((prev) => (prev ? { ...prev, current: report } : prev));
      if (report.delivered_count > 0) toast.success(`Enviado para ${plural(report.delivered_count, 'destino', 'destinos')}`);
      else toast.error('Nenhum destino recebeu. Confira a lista abaixo.');
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui enviar agora.');
    } finally {
      setBusy(null);
    }
  };

  const config = payload?.config;
  const atual = payload?.current;
  const jaEnviado = atual?.status === 'sent';
  const destinos = (config?.group_jids.length ?? 0) + (config?.user_ids.length ?? 0);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  if (loading && !payload) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        O resumo da semana dos atendimentos — o que a IA entregou e o que o time fez — enviado no
        WhatsApp pelo número operacional da Leal Mídia. Monte a prévia, confira, edite o texto e mande.
      </p>

      {/* Prévia */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void gerarPrevia()} disabled={busy !== null}>
          {busy === 'preview' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Gerar prévia
        </Button>
        {/* A pergunta que esta aba não sabia responder. Fica sempre à mão, e não só
            depois de um erro: quem chega aqui e não vê relatório precisa dela. */}
        <Button size="sm" variant="ghost" onClick={() => void carregarDiagnostico()} disabled={checando}>
          {checando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Por que não está saindo?
        </Button>
        {atual && <span className="text-sm text-muted-foreground">Semana de {atual.period_label}</span>}
      </div>

      {/* O veredito de cada peça do caminho, em português, vindo do servidor. */}
      {checks && (
        <div className="rounded-md border border-sidebar-border p-3 space-y-2">
          <p className="text-sm font-medium">O caminho do relatório</p>
          {checks.map((c) => (
            <div key={c.chave} className="flex gap-2 text-sm">
              {/* ⚠️ Situação nova do servidor sem cor aqui sai com a aparência de
                  FALHA, que é outra coisa. Hoje são quatro: ok, alerta, falha e a
                  conferência que ainda está rodando. */}
              <span
                className={
                  c.situacao === 'ok'
                    ? 'text-green-600'
                    : c.situacao === 'alerta'
                      ? 'text-amber-500'
                      : c.situacao === 'pendente'
                        ? 'text-muted-foreground'
                        : 'text-red-500'
                }
              >
                {c.situacao === 'pendente' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : c.situacao === 'ok' ? (
                  '✓'
                ) : c.situacao === 'alerta' ? (
                  '!'
                ) : (
                  '✕'
                )}
              </span>
              <span>
                <span className="font-medium">{c.titulo}</span>
                <span className="text-muted-foreground"> — {c.detalhe}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ⚠️ Medição quebrada e semana parada produziam a MESMA tela: tudo zero, sem
          aviso. Estas linhas são o que separa uma coisa da outra. */}
      {(atual?.avisos?.length ?? 0) > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
          {atual?.avisos?.map((aviso, i) => (
            <p key={i} className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>
          ))}
        </div>
      )}

      {/* Sem relatório na tela, dizer o que fazer — e não deixar um vazio que parece
          defeito, que é como esta aba se apresentava quando o botão falhava. */}
      {!atual && !loading && (
        <div className="rounded-md border border-dashed border-sidebar-border p-4 text-sm text-muted-foreground">
          Nenhum relatório montado ainda. Clique em <span className="font-medium">Gerar prévia</span> para
          montar o da semana fechada mais recente. Se ele não aparecer, o botão{' '}
          <span className="font-medium">Por que não está saindo?</span> diz em qual ponto travou.
        </div>
      )}

      {atual && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatsBlock
              titulo="A IA"
              icone={<Bot className="h-4 w-4" />}
              linhas={[
                ['Leads atendidos', atual.stats?.ia?.attended ?? 0],
                ['Responderam', atual.stats?.ia?.answered ?? 0],
                ['Qualificados', atual.stats?.ia?.qualified ?? 0],
                ['Visitas marcadas', atual.stats?.ia?.visits ?? 0],
                ['Passados para corretor', atual.stats?.ia?.handoffs ?? 0],
              ]}
            />
            <StatsBlock
              titulo="O time"
              icone={<Users className="h-4 w-4" />}
              linhas={[
                ['Leads novos', Number((atual.stats?.equipe as Record<string, unknown>)?.new_leads ?? 0)],
                ['Reativados', Number((atual.stats?.equipe as Record<string, unknown>)?.reactivated ?? 0)],
                ['Follow-ups enviados', Number((atual.stats?.equipe as Record<string, unknown>)?.followups_sent ?? 0)],
                ['Mensagens enviadas', Number((atual.stats?.equipe as Record<string, unknown>)?.messages_sent ?? 0)],
                ['Mensagens recebidas', Number((atual.stats?.equipe as Record<string, unknown>)?.messages_received ?? 0)],
              ]}
            />
          </div>

          <div>
            <Label>O texto que vai no WhatsApp</Label>
            <Textarea
              rows={12}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={jaEnviado}
              className="font-mono text-xs"
            />
            {jaEnviado ? (
              <p className="text-xs text-muted-foreground mt-1">
                Este relatório já foi enviado — o que está aqui é o que chegou no WhatsApp.
              </p>
            ) : (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void salvarTexto()} disabled={busy !== null}>
                {busy === 'text' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvar texto
              </Button>
            )}
          </div>

          {atual.results.length > 0 && (
            <ul className="space-y-1">
              {atual.results.map((r, i) => (
                <li key={i} className="text-xs flex items-center gap-2">
                  <span className={r.ok ? 'text-green-600' : 'text-red-500'}>{r.ok ? '✓' : '✕'}</span>
                  <span>{r.label}</span>
                  {r.detail && <span className="text-muted-foreground">— {r.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Destinos */}
      <div className="pt-2 border-t border-sidebar-border space-y-3">
        <Label>Para quem vai</Label>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Grupos de WhatsApp desta imobiliária</p>
          {targets.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum grupo desta imobiliária foi encontrado no número operacional. Você ainda pode
              mandar para os gestores abaixo.
            </p>
          ) : (
            targets.groups.map((g) => (
              <label key={g.jid} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={config?.group_jids.includes(g.jid) ?? false}
                  onChange={() => void salvarConfig({ group_jids: alternar(config?.group_jids ?? [], g.jid) }, { quiet: true })}
                />
                {g.name}
              </label>
            ))
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Gestores</p>
          {targets.managers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum gestor com WhatsApp cadastrado. O número sai do cadastro da pessoa, em
              Configurações → Equipe.
            </p>
          ) : (
            targets.managers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={config?.user_ids.includes(String(m.id)) ?? false}
                  onChange={() => void salvarConfig({ user_ids: alternar(config?.user_ids ?? [], String(m.id)) }, { quiet: true })}
                />
                {m.name} <span className="text-xs text-muted-foreground">{m.phone_masked}</span>
              </label>
            ))
          )}
        </div>

        {/* A contagem fica embaixo do dedo: disparo em grupo de cliente é irreversível. */}
        <Button onClick={() => void enviar()} disabled={busy !== null || !atual || jaEnviado || destinos === 0}>
          {busy === 'send' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Enviar agora {destinos > 0 && `(${destinos})`}
        </Button>
      </div>

      {/* Automático */}
      <div className="pt-2 border-t border-sidebar-border space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            onChange={(e) => void salvarConfig({ enabled: e.target.checked })}
          />
          Enviar toda semana, sozinho
        </label>
        {config?.enabled && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Seletor
                value={config.weekday}
                onChange={(e) => void salvarConfig({ weekday: Number(e.target.value) })}
                className="w-28 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
              >
                {WEEKDAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Seletor>
              <span className="text-sm text-muted-foreground">às</span>
              <Seletor
                value={config.hour}
                onChange={(e) => void salvarConfig({ hour: Number(e.target.value) })}
                className="w-24 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </Seletor>
            </div>
            <p className="text-xs text-muted-foreground">
              O relatório sempre cobre a semana fechada anterior (segunda a domingo), para uma
              semana poder ser comparada com a outra. Sai uma vez só, mesmo que o horário passe batido.
            </p>
          </>
        )}
      </div>

      {/* Histórico */}
      {(payload?.history.length ?? 0) > 0 && (
        <div className="pt-2 border-t border-sidebar-border">
          <Label>Últimos envios</Label>
          <ul className="space-y-1 mt-2">
            {payload!.history.map((r) => (
              <li key={r.id} className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">{r.period_label}</span>
                {r.status === 'sent' ? (
                  <span className="text-xs text-green-600">
                    enviado para {r.delivered_count}{r.failed_count > 0 && `, ${r.failed_count} falhou`}
                  </span>
                ) : r.status === 'failed' ? (
                  <span className="text-xs text-red-500">falhou</span>
                ) : (
                  <span className="text-xs text-muted-foreground">rascunho</span>
                )}
                {r.automatic && <span className="text-xs text-muted-foreground">(automático)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatsBlock({ titulo, icone, linhas }: { titulo: string; icone: React.ReactNode; linhas: [string, number][] }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
      <div className="text-sm font-medium flex items-center gap-2 mb-2">{icone} {titulo}</div>
      <ul className="space-y-1">
        {linhas.map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{rotulo}</span>
            <span className="font-medium">{valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
