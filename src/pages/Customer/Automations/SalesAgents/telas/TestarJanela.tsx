// Testar (onda 3, decisão 5): janela POR CIMA da página, aberta pelo botão da
// barra. Fundo escurece (~250 ms), o celular sobe de baixo (~450 ms) e os painéis
// entram pelos lados 120 ms depois. Com "reduzir movimento" no sistema, só
// aparece. Fecha em Fechar, clique fora e Esc; o foco fica preso dentro e volta
// pra quem abriu. Abaixo de ~1000 px os painéis descem pra baixo do celular.
//
// Esquerda: o lead do teste. Centro: o celular. Direita: o que ela está fazendo
// (caminho, temperatura, qualificação, o que aconteceria, avançar o tempo).
// Tudo usa o ensaio de hoje (useEnsaio); o novo é só o Caminho (onda 2: sem ele
// no estado, o painel diz "Ainda não escolheu").
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Send } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { CENARIOS_DE_TESTE } from '@/features/salesAgents/cenariosDeTeste';
import {
  AVANCOS_DA_JANELA, avisoDoModelo, linhaDoCard, linhasDoQueAconteceria, painelDoEnsaio, pausa,
} from '@/features/salesAgents/ensaio';
import { fraseDoObjetivo } from '@/features/salesAgents/resumoDosPassos';
import { cn } from '@/lib/utils';
import TestMediaBubble from '../TestMediaBubble';
import { useEnsaio } from './useEnsaio';

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PAINEL = 'flex max-h-[calc(100dvh-3rem)] w-full max-w-[300px] flex-col gap-3.5 overflow-auto rounded-[20px] bg-card p-4 text-card-foreground shadow-2xl';
const TITULO = 'text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground';

export default function TestarJanela({ agent, aoFechar }: { agent: SalesAgent; aoFechar: () => void }) {
  const e = useEnsaio(agent);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [real, setReal] = useState(false);
  const painel = painelDoEnsaio(e.ensaio, e.ficha);
  const card = linhaDoCard(e.ficha);
  const linhas = [...linhasDoQueAconteceria(e.ficha), ...(card ? [card] : [])];
  const modelo = avisoDoModelo(e.ficha?.test_model ?? agent.test_model, agent.model);
  const nomeVisto = (agent.lead_facing_name ?? '').trim() || agent.name;
  const cenarios = [...CENARIOS_DE_TESTE, ...e.salvos];
  const cenarioAtual = cenarios.find((c) => c.id === e.cenario);

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
      // ⚠️ A lista aberta do Seletor e a pergunta do "Salvar este cenário" (Radix)
      // tratam o próprio Esc e marcam o evento: aí o Esc fecha SÓ elas, não o Testar.
      if (ev.defaultPrevented) return;
      if (ev.key === 'Escape') { fecharRef.current(); return; }
      if (ev.key !== 'Tab' || !caixa.current) return;
      const ativo = document.activeElement;
      const dentro = !!ativo && caixa.current.contains(ativo);
      // Foco numa camada própria (lista do Seletor, pergunta): ela cuida do Tab.
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
        {/* Esquerda · Lead do teste (abaixo de ~1000 px vai pra baixo do celular) */}
        <aside aria-label="Lead do teste" className={cn(PAINEL, 'pointer-events-auto order-2 min-[1000px]:order-1',
          'animate-in fade-in slide-in-from-left-10 duration-[450ms] delay-[120ms] [animation-fill-mode:both] motion-reduce:animate-none')}>
          <div className="space-y-2">
            <h3 className={TITULO}>Cenário</h3>
            <Seletor aria-label="Cenário" className="h-10 w-full" value={e.cenario} disabled={aguardando}
              onChange={(ev) => { const c = cenarios.find((x) => x.id === ev.target.value); if (c) e.aplicarCenario(c); }}>
              <option value="">Conversa livre</option>
              {cenarios.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Seletor>
            {cenarioAtual && <p className="text-[12.5px] text-muted-foreground">{cenarioAtual.subtitulo}</p>}
            {cenarioAtual?.id.startsWith('custom-') && (
              <Button type="button" variant="ghost" size="sm" onClick={() => e.removerCenario(cenarioAtual.id)}>Remover este cenário</Button>
            )}
          </div>
          <div className="space-y-2">
            <h3 className={TITULO}>Lead do teste</h3>
            <Input aria-label="Nome do lead" value={e.nome} onChange={(ev) => e.setNome(ev.target.value)} />
            <Input aria-label="De onde veio" placeholder="Anúncio do Instagram" value={e.origem} onChange={(ev) => e.setOrigem(ev.target.value)} />
            <Input aria-label="Imóvel" placeholder="Código do imóvel" value={e.imovel} onChange={(ev) => e.setImovel(ev.target.value)} />
            <Textarea aria-label="Respostas do formulário" rows={2} placeholder="Faixa de investimento: até 450 mil" value={e.respostas} onChange={(ev) => e.setRespostas(ev.target.value)} />
          </div>
          {real ? (
            <div className="space-y-2">
              <Input aria-label="Telefone com DDD" placeholder="Telefone com DDD" value={e.telefone} onChange={(ev) => e.setTelefone(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') void e.carregar(); }} />
              <Button type="button" variant="outline" className="w-full" disabled={e.carregando || !e.telefone.trim()} onClick={() => void e.carregar()}>
                {e.carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Carregando" /> : 'Carregar'}
              </Button>
              <p className="text-xs text-muted-foreground">Só lê: pode ser um lead ativo. Traz a conversa, a ficha e a abertura.</p>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setReal(true)}>Usar a conversa de um lead real</Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => void e.salvarCenario()}>Salvar este cenário</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={e.ocupado} onClick={e.recomecar}>Recomeçar</Button>
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
                <p className="text-[11px] opacity-80">{e.ocupado ? 'digitando…' : 'online'}</p>
              </div>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">TESTE</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-3" aria-live="polite">
              {e.itens.length === 0 && <p className="py-8 text-center text-xs text-[#625c72]">Escreva como o lead pra ver ela responder.</p>}
              {e.itens.map((it, i) => {
                if (it.tipo === 'sistema') return <span key={i} className="self-center rounded-lg bg-white/75 px-2.5 py-1 text-center text-[11px] text-[#4b4558]">{it.texto}</span>;
                if (it.tipo === 'midia') {
                  return (
                    <div key={i} className="self-start">
                      <TestMediaBubble item={it.item}
                        // O imóvel do TURNO que gerou esta bolha, não o do campo agora.
                        onSendToMe={(item, phone) => salesAgentsService.testSend(agent.id, { phone, token: item.token, property_code: it.propertyCode || undefined }).then((r) => r.message)} />
                    </div>
                  );
                }
                const lead = it.tipo === 'lead';
                return (
                  <div key={i} className={cn('flex max-w-[80%] flex-col', lead ? 'items-end self-end' : 'items-start self-start')}>
                    {!lead && it.pausa > 0 && <span className="text-[10px] text-[#625c72]">{pausa(it.pausa)}</span>}
                    <p className={cn('whitespace-pre-wrap px-2.5 py-1.5 text-[12.5px] leading-snug text-[#111]', lead ? 'rounded-[10px_10px_2px_10px] bg-[#d9fdd3]' : 'rounded-[10px_10px_10px_2px] bg-white')}>
                      {!lead && it.audio ? '🎤 áudio: ' : ''}{it.texto}
                    </p>
                  </div>
                );
              })}
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
              {painel.perguntas.map((p) => (
                <li key={p.texto} className="flex items-start gap-2 text-[13px] leading-snug">
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
            <div className="space-y-1 rounded-xl border border-border p-2.5 text-[13px]">
              {linhas.length ? linhas.map((l) => <p key={l}>{l}</p>) : <p>{fraseDoObjetivo(agent)}</p>}
            </div>
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
      {e.dialogoDePergunta}
    </>,
    document.body,
  );
}
