// Testar (onda 3, decisão 5): janela POR CIMA da página, aberta pelo botão da
// barra. Fundo escurece (~250 ms), o celular sobe de baixo (~450 ms) e os painéis
// entram pelos lados 120 ms depois. Com "reduzir movimento" no sistema, só
// aparece. Fecha em Fechar, clique fora e Esc; o foco fica preso dentro e volta
// pra quem abriu. Abaixo de ~1000 px os painéis descem pra baixo do celular.
//
// Esquerda: o cenário e o lead do teste. Centro: o celular. Direita: o que ela
// está fazendo (caminho, temperatura, qualificação, o que aconteceria, avançar o
// tempo). Tudo usa o ensaio (useEnsaio).
//
// 07/10/2026 (pedido do dono do produto): cenários em cartões, sem campo pra
// preencher (o lead é quem está testando); "Respeitar o gatilho"; o celular com
// os pontinhos, uma bolha de cada vez, hora e tiques.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCheck, ChevronDown, Loader2, Send } from 'lucide-react';
import { Button, Input, Label as UILabel, Switch } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { CENARIOS_DO_TESTAR } from '@/features/salesAgents/cenariosDeTeste';
import {
  AVANCOS_DA_JANELA, avisoDoModelo, juntarTravas, linhaDoCard, oQueAconteceria, painelDoEnsaio, rotuloDaPergunta,
} from '@/features/salesAgents/ensaio';
import { fraseDoObjetivo } from '@/features/salesAgents/resumoDosPassos';
import { cn } from '@/lib/utils';
import TestMediaBubble from '../TestMediaBubble';
import { temGatilho, useEnsaio } from './useEnsaio';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PAINEL = 'flex max-h-[calc(100dvh-3rem)] w-full max-w-[300px] flex-col gap-3.5 overflow-auto rounded-[20px] bg-card p-4 text-card-foreground shadow-2xl';
const TITULO = 'text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground';
const ENTRA = 'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none';
const LIVRE = { id: '', label: 'Conversa livre', subtitulo: 'Você escreve como o lead, do zero.' };

const NOTA_DO_FORMULARIO: Record<string, string> = {
  lead: 'Respostas do último lead que chegou por este formulário, sem nome e telefone.',
  questions: 'Ainda não chegou lead por este formulário: respostas de exemplo com as perguntas dele.',
  none: 'Ainda não chegou lead por este formulário: usando respostas de exemplo.',
};

/** `ritmo`: 0 nos testes (as bolhas chegam sem esperar). */
export default function TestarJanela({ agent, aoFechar, ritmo = 1 }: { agent: SalesAgent; aoFechar: () => void; ritmo?: number }) {
  const e = useEnsaio(agent, ritmo);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const painel = painelDoEnsaio(e.ensaio, e.ficha);
  const card = linhaDoCard(e.ficha);
  const { travas, linhas: acoes } = oQueAconteceria(e.ficha);
  const linhas = [...acoes, ...(card ? [card] : [])];
  const modelo = avisoDoModelo(e.ficha?.test_model ?? agent.test_model, agent.model);
  const nomeVisto = (agent.lead_facing_name ?? '').trim() || agent.name;
  const cartoes = [LIVRE, ...CENARIOS_DO_TESTAR];
  const cenarioAtual = CENARIOS_DO_TESTAR.find((c) => c.id === e.cenario);
  const comGatilho = temGatilho(agent);
  const noFormulario = e.cenario === 'form';
  const respostas = Object.entries(e.respostas);
  const notaDoFormulario = e.comFormulario && noFormulario && !e.lendoFormularios
    ? NOTA_DO_FORMULARIO[e.formularioAtual?.origin ?? 'none'] : null;

  // Foco: entra no campo do lead; ao fechar, volta pra quem abriu (o botão Testar).
  // A página de trás não rola por baixo da janela enquanto ela está aberta.
  useEffect(() => {
    const quemAbriu = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    campo.current?.focus();
    return () => {
      document.body.style.overflow = rolagem;
      if (quemAbriu?.isConnected) quemAbriu.focus();
    };
  }, []);

  // Esc e Tab no documento (não só na caixa): clicar no fundo do celular tira o foco
  // de tudo, e o Esc tem que fechar mesmo assim.
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    const teclar = (ev: globalThis.KeyboardEvent) => {
      // ⚠️ A lista aberta do Seletor (Radix) trata o próprio Esc e marca o evento:
      // aí o Esc fecha SÓ ela, não o Testar.
      if (ev.defaultPrevented) return;
      if (ev.key === 'Escape') { fecharRef.current(); return; }
      if (ev.key !== 'Tab' || !caixa.current) return;
      const ativo = document.activeElement;
      const dentro = !!ativo && caixa.current.contains(ativo);
      // Foco numa camada própria (lista do Seletor): ela cuida do Tab.
      if (!dentro && ativo && ativo !== document.body) return;
      const lista = Array.from(caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!dentro) { ev.preventDefault(); (ev.shiftKey ? ultimo : primeiro).focus(); }
      else if (ev.shiftKey && ativo === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && ativo === ultimo) { ev.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  }, []);

  const aguardando = e.ocupado || e.carregando;

  return createPortal(
    <>
      <div data-testid="fundo-do-testar" aria-hidden onClick={aoFechar}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px] animate-in fade-in duration-[250ms] motion-reduce:animate-none" />
      <div ref={caixa} role="dialog" aria-modal="true" aria-label="Testar a IA"
        className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center gap-6 overflow-y-auto p-5 min-[1000px]:flex-row min-[1000px]:justify-center">
        {/* Esquerda · Cenário e lead do teste (abaixo de ~1000 px vai pra baixo do celular) */}
        <aside aria-label="Lead do teste" className={cn(PAINEL, 'pointer-events-auto order-2 min-[1000px]:order-1',
          'animate-in fade-in slide-in-from-left-10 duration-[450ms] delay-[120ms] [animation-fill-mode:both] motion-reduce:animate-none')}>
          <div className="space-y-2">
            <h3 id="testar-cenario" className={TITULO}>Cenário</h3>
            <div role="radiogroup" aria-labelledby="testar-cenario" className="space-y-1.5">
              {cartoes.map((c) => {
                const marcado = e.cenario === c.id;
                return (
                  <button key={c.id || 'livre'} type="button" role="radio" aria-checked={marcado} disabled={aguardando}
                    onClick={() => void e.escolherCenario(c.id)}
                    className={cn('w-full rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60',
                      marcado ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60')}>
                    <span className="block text-[13px] font-semibold">{c.label}</span>
                    {marcado && <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{c.subtitulo}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {noFormulario && (
            <div className="space-y-2">
              <h3 className={TITULO}>O que ele respondeu</h3>
              {e.lendoFormularios && (
                <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Lendo os formulários desta IA…
                </p>
              )}
              {(e.formularios?.length ?? 0) > 1 && (
                <Seletor aria-label="Formulário" className="h-10 w-full" value={e.formularioAtual?.form_id ?? ''} disabled={aguardando}
                  onChange={(ev) => e.escolherFormulario(ev.target.value)}>
                  {(e.formularios ?? []).map((f) => <option key={f.form_id} value={f.form_id}>{f.name}</option>)}
                </Seletor>
              )}
              {(e.formularios?.length ?? 0) === 1 && <p className="text-[12.5px] font-semibold">{e.formularioAtual?.name}</p>}
              <dl className="space-y-1.5 rounded-xl border border-border p-2.5 text-[12.5px]">
                {respostas.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{rotuloDaPergunta(k)}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {notaDoFormulario && <p className="text-xs text-muted-foreground">{notaDoFormulario}</p>}
            </div>
          )}

          <div className="space-y-2">
            <h3 className={TITULO}>Lead do teste</h3>
            <p className="text-[13px]"><span className="font-semibold">{e.nome}</span>{e.origem ? <span className="text-muted-foreground"> · {e.origem}</span> : null}</p>
            <Input aria-label="Imóvel" placeholder="Código do imóvel (opcional)" value={e.imovel} onChange={(ev) => e.setImovel(ev.target.value)} />
          </div>

          {comGatilho && (
            <div className="flex items-start gap-3">
              <Switch id="testar-gatilho" checked={e.respeitarGatilho} className="mt-0.5" aria-describedby="testar-gatilho-frase"
                onCheckedChange={(v) => e.setRespeitarGatilho(v)} />
              <div className="space-y-0.5">
                <UILabel htmlFor="testar-gatilho" className="cursor-pointer text-[13px] font-semibold">Respeitar o gatilho</UILabel>
                <p id="testar-gatilho-frase" className="text-xs text-muted-foreground">
                  {e.respeitarGatilho
                    ? 'Igual ao atendimento: se o gatilho não bater, ela fica calada.'
                    : 'Ela responde qualquer mensagem. Quando no atendimento ela não entraria, o teste avisa.'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button type="button" aria-expanded={maisOpcoes} onClick={() => setMaisOpcoes((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Mais opções <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', maisOpcoes && 'rotate-180')} aria-hidden />
            </button>
            {maisOpcoes && (
              <div className="space-y-2">
                <p className="text-[12.5px] font-semibold">Usar a conversa de um lead real</p>
                <Input aria-label="Telefone com DDD" placeholder="Telefone com DDD" value={e.telefone} onChange={(ev) => e.setTelefone(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') void e.carregar(); }} />
                <Button type="button" variant="outline" className="w-full" disabled={e.carregando || !e.telefone.trim()} onClick={() => void e.carregar()}>
                  {e.carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Carregando" /> : 'Carregar'}
                </Button>
                <p className="text-xs text-muted-foreground">Só lê: pode ser um lead ativo. Traz a conversa, a ficha e a abertura.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={aguardando} onClick={e.recomecar}>Recomeçar</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={aoFechar}>Fechar</Button>
          </div>
        </aside>

        {/* Centro · o celular */}
        <div data-testid="celular-do-testar"
          className="pointer-events-auto order-1 h-[640px] max-h-[calc(100dvh-3rem)] w-full max-w-[320px] shrink-0 rounded-[46px] bg-[#141118] p-[11px] shadow-2xl min-[1000px]:order-2 animate-in fade-in slide-in-from-bottom-20 duration-[450ms] motion-reduce:animate-none">
          <div className="flex h-full flex-col overflow-hidden rounded-[36px] bg-[#ece5dc]">
            <div className="flex items-center gap-2.5 bg-[#075e54] px-3.5 pb-2.5 pt-7 text-white">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-violet-200 font-bold text-violet-900" aria-hidden>{nomeVisto.charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{nomeVisto}</p>
                <p className="text-[11px] opacity-80">{e.digitando ? 'digitando…' : 'online'}</p>
              </div>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">TESTE</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-3" aria-live="polite">
              {e.itens.length === 0 && !cenarioAtual && <p className="py-8 text-center text-xs text-[#625c72]">Escreva como o lead pra ver ela responder.</p>}
              {e.itens.map((it, i) => {
                if (it.tipo === 'sistema') return <span key={i} className={cn('self-center rounded-lg bg-white/75 px-2.5 py-1 text-center text-[11px] text-[#4b4558]', ENTRA)}>{it.texto}</span>;
                if (it.tipo === 'midia') {
                  return (
                    <div key={i} className={cn('self-start', ENTRA)}>
                      <TestMediaBubble item={it.item}
                        // O imóvel do TURNO que gerou esta bolha, não o do campo agora.
                        onSendToMe={(item, phone) => salesAgentsService.testSend(agent.id, { phone, token: item.token, property_code: it.propertyCode || undefined }).then((r) => r.message)} />
                    </div>
                  );
                }
                const lead = it.tipo === 'lead';
                return (
                  <div key={i} className={cn('flex max-w-[80%] flex-col', lead ? 'items-end self-end' : 'items-start self-start', ENTRA)}>
                    <div className={cn('px-2.5 pb-1 pt-1.5 text-[12.5px] leading-snug text-[#111]', lead ? 'rounded-[10px_10px_2px_10px] bg-[#d9fdd3]' : 'rounded-[10px_10px_10px_2px] bg-white')}>
                      <p className="whitespace-pre-wrap">{!lead && it.audio ? '🎤 áudio: ' : ''}{it.texto}</p>
                      {(it.hora || lead) && (
                        <span className="float-right -mb-0.5 ml-2 mt-0.5 flex items-center gap-0.5 text-[10px] text-[#667781]">
                          {it.hora}
                          {lead && <Tiques lida={it.lida} enviada={!!it.hora || it.lida !== undefined} />}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {e.digitando && (
                <div data-testid="digitando" aria-label="digitando" className={cn('flex gap-1 self-start rounded-[10px_10px_10px_2px] bg-white px-3 py-2.5', ENTRA)}>
                  {[0, 150, 300].map((d) => (
                    <span key={d} aria-hidden style={{ animationDelay: `${d}ms` }}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] motion-reduce:animate-none" />
                  ))}
                </div>
              )}
              <div ref={e.fimDoChat} />
            </div>
            <div className="flex gap-1.5 bg-[#ece5dc] p-2">
              <input ref={campo} aria-label="Mensagem do lead" placeholder="Escreva como o lead…" value={e.mensagem}
                onChange={(ev) => e.setMensagem(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') void e.enviar(); }}
                className="min-w-0 flex-1 rounded-full bg-white px-3 py-2 text-[12.5px] text-[#111] outline-none placeholder:text-[#7a7486] focus-visible:ring-2 focus-visible:ring-emerald-600" />
              <button type="button" aria-label="Enviar" disabled={e.ocupado || !e.mensagem.trim()} onClick={() => void e.enviar()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-50">
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Direita · o que ela está fazendo */}
        <aside aria-label="O que ela está fazendo" className={cn(PAINEL, 'pointer-events-auto order-3',
          'animate-in fade-in slide-in-from-right-10 duration-[450ms] delay-[120ms] [animation-fill-mode:both] motion-reduce:animate-none')}>
          <div className="space-y-1.5">
            <h3 className={TITULO}>Caminho</h3>
            {painel.caminho
              ? <p><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{painel.caminho}</span></p>
              : <p className="text-[12.5px] text-muted-foreground">Ainda não escolheu.</p>}
          </div>
          <div className="space-y-1.5">
            <h3 className={TITULO}>Temperatura</h3>
            {painel.temperatura ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${(painel.temperatura.nivel / 3) * 100}%` }} />
                </div>
                <p className="text-[13px] font-semibold">{painel.temperatura.rotulo}</p>
              </>
            ) : <p className="text-[12.5px] text-muted-foreground">Aparece depois da primeira resposta.</p>}
          </div>
          <div className="space-y-1.5">
            <h3 className={TITULO}>Qualificação</h3>
            {painel.perguntas.length === 0 && <p className="text-[12.5px] text-muted-foreground">Sem perguntas ainda.</p>}
            <ul className="space-y-1">
              {/* Índice na chave: duas perguntas iguais são permitidas na Qualificação. */}
              {painel.perguntas.map((p, i) => (
                <li key={`${i}-${p.texto}`} className="flex items-start gap-2 text-[13px] leading-snug">
                  <span aria-hidden className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold', p.resposta ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground')}>{p.resposta ? '✓' : '·'}</span>
                  <span>
                    <span className={p.obrigatoria ? 'font-semibold' : undefined}>{p.texto}</span>
                    {p.obrigatoria && !p.resposta && <span className="text-muted-foreground"> obrigatória</span>}
                    <span className="sr-only">{p.resposta ? ', respondida' : ', faltando'}{p.obrigatoria && p.resposta ? ', obrigatória' : ''}</span>
                    {p.resposta && <span className="text-muted-foreground">: {p.resposta}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <h3 className={TITULO}>O que aconteceria</h3>
            {travas.length > 0 && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[13px] leading-snug text-amber-800 dark:text-amber-300">
                <span className="font-semibold">No atendimento real ela ficaria calada:</span> {juntarTravas(travas)}. O teste respondeu mesmo assim.
              </p>
            )}
            {(linhas.length > 0 || travas.length === 0) && (
              <div className="space-y-1 rounded-xl border border-border p-2.5 text-[13px]">
                {linhas.length ? linhas.map((l, i) => <p key={`${i}-${l}`}>{l}</p>) : <p>{fraseDoObjetivo(agent)}</p>}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <h3 className={TITULO}>Avançar o tempo</h3>
            <p className="text-[12.5px] text-muted-foreground">Simula o lead calado pra ver a retomada e o follow-up.</p>
            <div className="flex flex-wrap gap-1.5">
              {AVANCOS_DA_JANELA.map((a) => (
                <Button key={a.rotulo} type="button" size="sm" variant="outline" disabled={!e.ensaio || e.ocupado} onClick={() => void e.avancar(a.horas)}>{a.rotulo}</Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Nada sai no WhatsApp. Usa o que está salvo.{modelo.selo ? ` ${modelo.selo}.` : ''}{modelo.nota ? ` ${modelo.nota}.` : ''}</p>
        </aside>
      </div>
    </>,
    document.body,
  );
}

/** ✓ enviada; ✓✓ cinza entregue (ela não respondeu); ✓✓ azul lida (ela respondeu). */
function Tiques({ lida, enviada }: { lida?: boolean; enviada: boolean }) {
  if (lida) return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-label="lida" />;
  if (enviada) return <CheckCheck className="h-3.5 w-3.5" aria-label="entregue" />;
  return <Check className="h-3.5 w-3.5" aria-label="enviada" />;
}
