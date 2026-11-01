// Números e usuários (Tarefa 71, 01/11/2026): o padrão da casa (ficha + prévia), um cartão por
// número do agente (a API própria dos números), "+ Adicionar número" e o Horário. Entrega BLOCOS
// (a moldura é o Card da página).
//
// ⚠️ A ficha da CASA grava pelo `gravar` (house_voice, por subchave); a de cada NÚMERO, pela API
// dos números (`useNumerosDoAgente`), que relê o agente: o cartão lê SEMPRE do agente, nunca de
// cópia local (armadilha 2 do Configurar). A ficha do número só guarda o que é diferente da casa.
// ⚠️ "Tirar número" confirma dentro do cartão (o app não usa confirm() do navegador).
import { useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import Aviso from '@/components/base/Aviso';
import { cn } from '@/lib/utils';
import {
  salesAgentsService, type AgentNumber, type ResumoDoAgente, type SalesAgent, type Voz,
} from '@/services/salesAgents/salesAgentsService';
import {
  O_QUE_A_VOZ_FAZ, ROTULO_DA_VOZ, formulariosDoNumero, previaDaApresentacao, vozDoNumero,
} from '@/features/salesAgents/fichas';
import { agentesDoNumero, avisoDoNumero } from '@/features/salesAgents/novoAgente';
import { FRASE_SEM_DONO } from '@/features/salesAgents/pendencias';
import type { PropsDaPagina } from '../paginas';
import { useNumerosDoAgente } from '../useNumerosDoAgente';
import FichaDaVoz from './FichaDaVoz';
import Horario from './Horario';

const PEDE_DONO = 'A voz Corretor pede o destino "Fica com o dono do número".';
const AVISO_OFICIAL = 'Pela API oficial a IA responde normalmente quem chamar. Abrir conversa com lead de formulário e mandar follow-up depois de 24h ainda não funcionam neste número. Acima de 1.000 respostas no mês, a Meta cobra cada resposta.';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

function Balao({ texto }: { texto: string }) {
  return (
    <div className="grid rounded-xl bg-muted/50 p-3">
      <p className="justify-self-start rounded-lg bg-card px-3 py-2 text-[13px] leading-snug shadow-sm">{texto}</p>
    </div>
  );
}

function Etiqueta({ children, tom }: { children: string; tom?: 'ok' | 'aviso' | 'roxo' }) {
  return (
    <Badge variant="outline"
      className={cn('font-medium', tom === 'ok' && 'text-emerald-700 dark:text-emerald-400', tom === 'aviso' && 'text-amber-700 dark:text-amber-400',
        tom === 'roxo' && 'text-primary', !tom && 'text-muted-foreground')}>
      {children}
    </Badge>
  );
}

export default function NumerosEUsuarios(props: PropsDaPagina) {
  const { agent, inboxes, gravar, irPara } = props;
  const { criar, mudar, tirar } = useNumerosDoAgente(agent, props.aoSalvo ?? (() => undefined));
  const [resumo, setResumo] = useState<ResumoDoAgente | null | undefined>(undefined);
  const [outros, setOutros] = useState<SalesAgent[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [adicionando, setAdicionando] = useState(false);
  const [escolhido, setEscolhido] = useState('');

  // Lidos uma vez ao abrir (nunca a cada tecla). Falhou: a página funciona sem eles.
  useEffect(() => {
    let vivo = true;
    salesAgentsService.resumos().then((r) => { if (vivo) setResumo(r.find((x) => x.id === agent.id) ?? null); }).catch(() => { if (vivo) setResumo(undefined); });
    salesAgentsService.list().then((l) => { if (vivo) setOutros(l.filter((a) => a.id !== agent.id)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [agent.id]);

  const casa = agent.house_voice ?? {};
  const numeros = agent.numbers ?? [];
  const corretorSemDestino = agent.handoff_target !== 'number_owner';
  const desconectados = numeros.filter((n) => !n.connected).length;
  const livres = inboxes.filter((i) => !numeros.some((n) => String(n.inbox_id) === String(i.id)));
  const avisoDoEscolhido = escolhido ? avisoDoNumero(escolhido, outros) : null;

  const gravarCasa = (campo: Partial<Voz>) => {
    const proxima = { ...casa, ...campo };
    (Object.keys(campo) as (keyof Voz)[]).forEach((k) => { if (campo[k] === undefined) delete proxima[k]; });
    return gravar({ house_voice: proxima }, Object.keys(campo).map((k) => `house_voice.${k}`));
  };
  const gravarVozDoNumero = (n: AgentNumber, campo: Partial<Voz>) => {
    const voz: Voz = { ...(n.voice ?? {}), ...campo };
    (Object.keys(voz) as (keyof Voz)[]).forEach((k) => { if (voz[k] === undefined || voz[k] === '') delete voz[k]; });
    return mudar(n.id, { voice: Object.keys(voz).length ? voz : null });
  };
  const conversas = (n: AgentNumber) => (resumo === undefined ? null : resumo?.numbers.find((x) => String(x.inbox_id) === String(n.inbox_id))?.conversations ?? 0);

  const tirarComConfirmacao = async (n: AgentNumber) => {
    const unico = numeros.length === 1;
    const sim = await confirmar({
      titulo: 'Tirar este número do agente?',
      descricao: `A IA para de atender nele. O número e as conversas continuam no LM Flow.${unico ? ' É o único número: sem ele a IA não tem onde atender.' : ''}`,
      rotuloDaAcao: 'Tirar', destrutivo: true,
    });
    if (sim) await tirar(n.id);
  };

  const adicionar = async () => {
    if (!escolhido) return;
    if (await criar({ inbox_id: escolhido })) { setEscolhido(''); setAdicionando(false); }
  };

  const vozCasa = vozDoNumero({ voice: null }, casa);

  return (
    <>
      <Secoes>
        <Secao titulo="Padrão da casa" descricao="Vale pra todo número sem ficha própria.">
          <div role="region" aria-label="Padrão da casa" className="grid items-start gap-6 lg:grid-cols-2">
            <FichaDaVoz idBase="casa" voz={casa} aoMudar={gravarCasa} />
            <div className="space-y-3">
              <Balao texto={previaDaApresentacao(vozCasa)} />
              {vozCasa.kind && <p className="text-sm text-muted-foreground">{O_QUE_A_VOZ_FAZ[vozCasa.kind]}</p>}
              {vozCasa.kind === 'corretor' && corretorSemDestino && <Aviso tom="atencao" compacto>{PEDE_DONO}</Aviso>}
            </div>
          </div>
        </Secao>

        <Secao titulo="Os números"
          descricao={`${plural(numeros.length, 'número', 'números')} · ${desconectados === 0 ? 'todos conectados' : plural(desconectados, 'desconectado', 'desconectados')}`}>
          <div className="grid gap-4 md:grid-cols-2">
            {numeros.map((n) => {
              const voz = vozDoNumero(n, casa);
              const nome = n.owner_name ?? n.inbox_name;
              const aberta = editando === n.id;
              const inbox = inboxes.find((i) => String(i.id) === String(n.inbox_id));
              const aviso = avisoDoNumero(n.inbox_id, outros);
              const conv = conversas(n);
              return (
                <article key={n.id} aria-label={nome} className="grid overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary" aria-hidden>{iniciais(nome)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {`número ${n.inbox_name}`}{n.owner_name ? ` · usuário ${n.owner_name}` : ' · sem usuário'}
                      </p>
                    </div>
                    <Etiqueta tom={n.connected ? 'ok' : 'aviso'}>{n.connected ? 'conectado' : 'desconectado'}</Etiqueta>
                  </div>
                  <div className="px-4 pb-4"><Balao texto={previaDaApresentacao(voz)} /></div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-3">
                    <Etiqueta tom="roxo">{voz.kind ? ROTULO_DA_VOZ[voz.kind] : 'Sem voz'}</Etiqueta>
                    <Etiqueta>{plural(formulariosDoNumero(n, agent.triggers), 'formulário', 'formulários')}</Etiqueta>
                    {conv !== null && <Etiqueta>{`${conv} ${conv === 1 ? 'conversa' : 'conversas'} em 30 dias`}</Etiqueta>}
                    {!n.enabled && <Etiqueta tom="aviso">desligado</Etiqueta>}
                    {voz.kind && <p className="basis-full pt-1 text-xs text-muted-foreground">{O_QUE_A_VOZ_FAZ[voz.kind]}</p>}
                  </div>
                  {(voz.kind === 'corretor' && corretorSemDestino) || (voz.kind === 'corretor' && !n.owner_user_id) || inbox?.oficial || aviso ? (
                    <div className="space-y-2 border-t border-border px-4 py-3">
                      {voz.kind === 'corretor' && corretorSemDestino && (
                        <Aviso tom="atencao" compacto
                          acao={<Button type="button" size="sm" variant="outline" onClick={() => irPara('destino')}>Abrir Destino</Button>}>{PEDE_DONO}</Aviso>
                      )}
                      {voz.kind === 'corretor' && !n.owner_user_id && <Aviso tom="erro" compacto>{FRASE_SEM_DONO}</Aviso>}
                      {inbox?.oficial && <Aviso tom="info" compacto>{AVISO_OFICIAL}</Aviso>}
                      {aviso && <Aviso tom="atencao" compacto>{aviso}</Aviso>}
                    </div>
                  ) : null}
                  {aberta && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <FichaDaVoz idBase={`numero-${n.id}`} voz={n.voice ?? {}} casa={casa} aoMudar={(campo) => gravarVozDoNumero(n, campo)} />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{aberta ? 'grava na hora' : n.voice ? 'ficha própria' : 'usa a ficha da casa'}</span>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(aberta ? null : n.id)}>{aberta ? 'Fechar' : 'Editar ficha'}</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void tirarComConfirmacao(n)}>Tirar número</Button>
                    </div>
                  </div>
                </article>
              );
            })}

            {adicionando ? (
              <div className="grid content-start gap-3 rounded-2xl border border-dashed border-border p-4">
                {livres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todos os números da conta já estão neste agente.</p>
                ) : (
                  <Campo id="numeros-novo" rotulo="Número de WhatsApp" ajuda="A ficha já vem da casa. Depois você muda em Editar ficha.">
                    <Seletor id="numeros-novo" className={`${CLASSE_DO_CAMPO} w-full`} value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
                      <option value="">Escolha o número</option>
                      {livres.map((i) => {
                        const tambem = agentesDoNumero(String(i.id), outros);
                        const base = i.oficial ? `${i.name} (API oficial)` : i.name;
                        return <option key={i.id} value={String(i.id)}>{tambem.length ? `${base} · também em ${tambem.join(', ')}` : base}</option>;
                      })}
                    </Seletor>
                  </Campo>
                )}
                {avisoDoEscolhido && <Aviso tom="atencao" compacto>{avisoDoEscolhido}</Aviso>}
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={!escolhido} onClick={() => void adicionar()}>Adicionar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setAdicionando(false); setEscolhido(''); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <button type="button" aria-label="+ Adicionar número" onClick={() => setAdicionando(true)}
                className="grid place-items-center gap-1 rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <b className="text-sm font-semibold text-foreground">+ Adicionar número</b>
                <span className="text-xs">Escolhe o número; a ficha já vem da casa.</span>
              </button>
            )}
          </div>
        </Secao>
      </Secoes>
      <Horario {...props} />
      {dialogoDeConfirmacao}
    </>
  );
}
