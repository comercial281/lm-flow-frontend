// Ensinar · Exemplos: "Responda assim" (lições good_example + conversas reais gravadas
// na IA) e "Não responda assim" (lições bad_example). Cartão = balão do lead à esquerda,
// balão dela à direita, rodapé com selo e ⋮. O servidor diz quais lições valem (`in_use`);
// a conversa real vale se a POSIÇÃO entre as que o servidor lê (`conversasReais`, que
// descarta resposta vazia) < limites.conversations. Editar/excluir usa o índice cru.
import { useMemo, useState } from 'react';
import { MessageSquareText, MoreVertical, Plus } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import type { SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';
import { conversasReais, type ConversaReal } from '../paginas';
import { SeloDeOrigem, dataCurta } from './LinhaDaLicao';
import type { PropsDaPaginaDoEnsinar } from './tipos';

type Aba = 'bom' | 'ruim';

type ItemDeExemplo =
  | { chave: string; fonte: 'licao'; licao: SalesAgentLesson; lead: string | null; resposta: string; valendo: boolean }
  | { chave: string; fonte: 'conversa'; indice: number; lead: string | null; resposta: string; valendo: boolean };

function itensDaAba(aba: Aba, licoes: SalesAgentLesson[], conversas: ConversaReal[], limiteDeConversas: number): ItemDeExemplo[] {
  const kind = aba === 'bom' ? 'good_example' : 'bad_example';
  const deLicoes: ItemDeExemplo[] = licoes.filter((l) => l.kind === kind).map((l) => ({
    chave: `l-${l.id}`, fonte: 'licao', licao: l, lead: l.context, resposta: l.content, valendo: l.enabled && l.in_use,
  }));
  if (aba === 'ruim') return deLicoes;
  // `posicao` entre as que o servidor lê (é o que o limite conta); `indice` é o cru.
  const deConversas: ItemDeExemplo[] = conversas.map((c, posicao) => ({
    chave: `c-${c.indice}`, fonte: 'conversa', indice: c.indice, lead: c.lead || null, resposta: c.resposta, valendo: posicao < limiteDeConversas,
  }));
  return [...deLicoes, ...deConversas];
}

const VAZIO: Record<Aba, { title: string; description: string }> = {
  bom: { title: 'Nenhum exemplo de como responder', description: 'Cole um trecho de conversa que deu certo: o que o lead disse e como um bom corretor respondeu.' },
  ruim: { title: 'Nenhum exemplo do que evitar', description: 'Quando ela responder de um jeito que você não gosta, guarde aqui pra ela não repetir.' },
};
const DICA: Record<Aba, string> = {
  bom: 'Ela imita o ritmo e o tom, não copia palavra por palavra.',
  ruim: 'Respostas que ela deve evitar.',
};

/** Estado do cartão de composição: `chave` null = exemplo novo. */
interface Composicao { chave: string | null; lead: string; resposta: string }

export default function Exemplos({ agent, gravar, licoes: L, confirmar }: PropsDaPaginaDoEnsinar) {
  const [aba, setAba] = useState<Aba>('bom');
  const [compor, setCompor] = useState<Composicao | null>(null);
  const [gravando, setGravando] = useState(false);

  // Cru: é o que se grava de volta (as que o servidor descarta continuam lá, intactas).
  const conversas = useMemo(() => agent.example_conversations ?? [], [agent.example_conversations]);
  const reais = useMemo(() => conversasReais(conversas), [conversas]);
  const bons = useMemo(() => itensDaAba('bom', L.licoes, reais, L.limites.conversations), [L.licoes, reais, L.limites.conversations]);
  const ruins = useMemo(() => itensDaAba('ruim', L.licoes, reais, L.limites.conversations), [L.licoes, reais, L.limites.conversations]);
  const itens = aba === 'bom' ? bons : ruins;

  const trocarAba = (a: Aba) => { setAba(a); setCompor(null); };

  const salvar = async () => {
    if (!compor || !compor.resposta.trim() || gravando) return;
    const resposta = compor.resposta.trim();
    const lead = compor.lead.trim();
    const alvo = compor.chave === null ? null : itens.find((i) => i.chave === compor.chave) ?? null;
    // Editando um exemplo que saiu da lista (excluído, movido, lista relida): fecha.
    // Cair no "criar" aqui faria um exemplo novo que ninguém pediu.
    if (compor.chave !== null && !alvo) { setCompor(null); return; }
    setGravando(true);
    try {
      let ok: boolean;
      if (!alvo) ok = await L.criar(aba === 'bom' ? 'good_example' : 'bad_example', resposta, lead || undefined);
      else if (alvo.fonte === 'licao') ok = await L.atualizar(alvo.licao.id, { content: resposta, context: lead || null });
      else ok = await gravar({ example_conversations: conversas.map((c, i) => (i === alvo.indice ? { lead, resposta } : c)) });
      if (ok) setCompor(null);
    } finally { setGravando(false); }
  };

  const apagar = async (item: ItemDeExemplo) => {
    if (!(await confirmar({ titulo: 'Excluir exemplo', descricao: item.resposta, rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    // A EDIÇÃO aberta aponta pra um item pela chave; as conversas reais são chaveadas
    // pelo índice, que anda quando uma sai. Fecha pra não editar a errada. Um exemplo
    // NOVO sendo escrito não aponta pra nada: fica aberto (fechar jogaria o texto fora).
    setCompor((c) => (c?.chave != null ? null : c));
    if (item.fonte === 'licao') await L.apagar(item.licao.id);
    else await gravar({ example_conversations: conversas.filter((_, i) => i !== item.indice) });
  };

  const mover = (l: SalesAgentLesson) => void L.atualizar(l.id, { kind: l.kind === 'good_example' ? 'bad_example' : 'good_example' });

  const composicao = (c: Composicao) => (
    <div className="space-y-3 rounded-xl border border-primary/40 p-4 ring-2 ring-primary/15">
      <CampoTexto id="en-ex-lead" rotulo="O que o lead disse" valor={c.lead} aoMudar={(v) => setCompor({ ...c, lead: v })} placeholder="Ex.: Achei caro." />
      <CampoTextoLongo id="en-ex-resp" rotulo={aba === 'bom' ? 'Como ela deve responder' : 'A resposta que ela não deve dar'}
        valor={c.resposta} aoMudar={(v) => setCompor({ ...c, resposta: v })} rows={3}
        placeholder={aba === 'bom' ? 'Ex.: Entendo! Muita gente usa o FGTS na entrada e a parcela cai bastante.' : 'Ex.: O valor é R$ 389.000.'} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void salvar()} disabled={!c.resposta.trim() || gravando}>Salvar exemplo</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setCompor(null)}>Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Secoes>
        <Secao titulo="Exemplos" descricao="Trechos de conversa que mostram a ela como responder, e como não responder.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Abas rotulo="Tipo de exemplo" ativa={aba} aoTrocar={(c) => trocarAba(c as Aba)}
              abas={[
                { chave: 'bom', rotulo: 'Responda assim', contagem: bons.length },
                { chave: 'ruim', rotulo: 'Não responda assim', contagem: ruins.length },
              ]} />
            <Button type="button" onClick={() => setCompor({ chave: null, lead: '', resposta: '' })}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Novo exemplo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{DICA[aba]}</p>
          {compor?.chave === null && composicao(compor)}
        </Secao>
      </Secoes>

      {L.estado === 'erro' ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void L.carregar()} />
      ) : L.estado === 'carregando' ? (
        <Secoes>
          <div role="status" aria-label="Carregando os exemplos" className="space-y-4 py-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
          </div>
        </Secoes>
      ) : itens.length === 0 ? (
        compor?.chave === null ? null : <EmptyState icon={MessageSquareText} title={VAZIO[aba].title} description={VAZIO[aba].description} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {itens.map((item, n) => compor?.chave === item.chave ? (
            <li key={item.chave} className="md:col-span-2">{composicao(compor)}</li>
          ) : (
            <li key={item.chave} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              {item.lead && (
                <div className="max-w-[85%] self-start">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Lead</p>
                  <p className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-[15px] leading-snug">{item.lead}</p>
                </div>
              )}
              <div className="max-w-[85%] self-end">
                <p className="mb-1 text-right text-xs font-semibold text-muted-foreground">{aba === 'bom' ? 'Ela' : 'Ela (não assim)'}</p>
                <p className={cn('rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[15px] leading-snug',
                  aba === 'bom' ? 'bg-emerald-500/15' : 'bg-red-500/10')}>{item.resposta}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {item.fonte === 'licao' ? (
                  <>
                    <SeloDeOrigem licao={item.licao} />
                    <span>{dataCurta(item.licao.created_at)}</span>
                  </>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-semibold text-emerald-800 dark:text-emerald-300">Conversa real</span>
                )}
                {item.fonte === 'licao' && !item.licao.enabled && <span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold">Pausado</span>}
                {item.fonte === 'conversa' || item.licao.enabled ? (!item.valendo && <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-300">Não está valendo</span>) : null}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Ações do exemplo ${n + 1}`} className="ml-auto text-muted-foreground">
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setCompor({ chave: item.chave, lead: item.lead ?? '', resposta: item.resposta })}>Editar</DropdownMenuItem>
                    {item.fonte === 'licao' && !item.licao.enabled && (
                      <DropdownMenuItem onSelect={() => void L.atualizar(item.licao.id, { enabled: true })}>Ligar</DropdownMenuItem>
                    )}
                    {item.fonte === 'licao' && (
                      <DropdownMenuItem onSelect={() => mover(item.licao)}>
                        {aba === 'bom' ? 'Mover pra Não responda assim' : 'Mover pra Responda assim'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive" onSelect={() => void apagar(item)}>Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
