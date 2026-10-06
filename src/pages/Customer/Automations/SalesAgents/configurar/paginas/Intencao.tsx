// Introdução · Intenção (onda 3, decisão 7). Quando ela pergunta, a pergunta e os
// CAMINHOS: pra cada resposta, como ela conduz (até 5). Lista gravada vazia = os 3
// de fábrica (Moradia, Investimento, Sondando, em `intent_paths_default`), e o
// comando que a IA recebe sai IDÊNTICO ao de antes (spec de comparação na onda 2).
// Mexer num caminho de fábrica passa a gravar a lista inteira; "Voltar aos de
// fábrica" apaga a lista própria.
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { CaminhoDaIntencao, IntentQuestionMode, PlaybookVars } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import type { PropsDaPagina } from '../paginas';

const MODOS: { valor: IntentQuestionMode; rotulo: string }[] = [
  { valor: 'always', rotulo: 'Sempre pergunta' },
  { valor: 'opening_only', rotulo: 'Só se ela abrir a conversa' },
  { valor: 'never', rotulo: 'Não pergunta, deduz' },
];
const PERGUNTA_PADRAO = 'Queria entender de fato o que você está buscando: seu foco é moradia, investimento, ou ainda não sabe e tá só sondando?';
const MAXIMO = 5;

export default function Intencao({ agent, gravar }: PropsDaPagina) {
  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const modo = (playbook.intent_question_mode as IntentQuestionMode | undefined) ?? 'always';
  const proprios = vars.caminhos_intencao ?? [];
  const deFabrica = proprios.length === 0;
  const caminhos = deFabrica ? (agent.intent_paths_default ?? []) : proprios;

  const gravarCaminhos = (lista: CaminhoDaIntencao[] | undefined) =>
    gravar({ playbook: { ...playbook, vars: { ...vars, caminhos_intencao: lista } } }, ['playbook.vars.caminhos_intencao']);
  const trocar = (i: number, p: Partial<CaminhoDaIntencao>) => gravarCaminhos(caminhos.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <Secoes>
      <Secao titulo="Pergunta de intenção" descricao="A pergunta que separa os leads logo no começo. A resposta decide qual caminho ela segue.">
        <BotoesDeEscolha rotulo="Quando perguntar" valor={modo} opcoes={MODOS}
          aoEscolher={(m) => void gravar({ playbook: { ...playbook, intent_question_mode: m === 'always' ? undefined : m } }, ['playbook.intent_question_mode'])} />
        {modo !== 'never' && (
          <TextoNaHora id="intencao-pergunta" rotulo="Pergunta" salvo={agent.intent_question ?? ''} placeholder={PERGUNTA_PADRAO}
            aoGravar={(v) => gravar({ intent_question: v.trim() ? v : null })} />
        )}
      </Secao>

      <Secao titulo="Caminhos" descricao="Pra cada resposta, como ela conduz dali pra frente. Se o lead não responder, ela deduz pelo que ele fala e escolhe o caminho.">
        {deFabrica && <p className="text-sm text-muted-foreground">Estes são os caminhos de fábrica. Mexer em um deles passa a valer a sua lista.</p>}
        <ol className="divide-y divide-border rounded-xl border border-border bg-background">
          {caminhos.map((c, i) => (
            <li key={i} className="flex flex-wrap items-start gap-3 p-3.5">
              <TextoNaHora id={`caminho-${i}-nome`} rotulo={`Resposta do caminho ${i + 1}`} salvo={c.nome} maxLength={40} className="w-44"
                aoGravar={(v) => (v.trim() ? trocar(i, { nome: v.trim() }) : undefined)} />
              <TextoNaHora id={`caminho-${i}-como`} tipo="varias" rows={2} rotulo="Como ela conduz" salvo={c.como} maxLength={300}
                className="min-w-[15rem] flex-1" aoGravar={(v) => trocar(i, { como: v.trim() })} />
              <Button type="button" variant="ghost" size="icon" className="mt-7" aria-label={`Remover o caminho ${c.nome}`}
                disabled={caminhos.length <= 1} onClick={() => void gravarCaminhos(caminhos.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" className="text-primary" aria-label="Novo caminho" disabled={caminhos.length >= MAXIMO}
            onClick={() => void gravarCaminhos([...caminhos, { nome: 'Novo caminho', como: '' }])}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Novo caminho
          </Button>
          <span className="text-xs text-muted-foreground">Até {MAXIMO} caminhos</span>
          {!deFabrica && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => void gravarCaminhos(undefined)}>Voltar aos de fábrica</Button>
          )}
        </div>
      </Secao>
    </Secoes>
  );
}
