// Introdução · Intenção. Caminhos MARCÁVEIS (08/10/2026): o catálogo (Moradia,
// Investimento, Primeiro imóvel, Trocar de imóvel) vem sempre na lista, a
// imobiliária marca o que vale e cria os dela. O servidor monta todo texto de
// intenção só com os marcados: "morar ou investir" só chega à IA com os dois
// marcados; com um só ela não pergunta intenção. Sondando não é caixinha (sempre
// ligado). Lista ausente = padrão (o servidor devolve em `intent_paths`); "Voltar
// ao padrão" grava o padrão do tipo de venda (`intent_paths_padrao`).
// A ORDEM da lista nunca muda aqui: o servidor só reconhece "de fábrica" se for
// igual ao catálogo NA ORDEM do catálogo (mapeia no lugar, próprio novo vai ao fim).
import { Plus, X } from 'lucide-react';
import { Button, Checkbox } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { CaminhoDaIntencao, ForaDosCaminhos, IntentQuestionMode, PlaybookVars } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import type { PropsDaPagina } from '../paginas';

const MODOS: { valor: IntentQuestionMode; rotulo: string }[] = [
  { valor: 'always', rotulo: 'Sempre pergunta' },
  { valor: 'opening_only', rotulo: 'Só se ela abrir a conversa' },
  { valor: 'never', rotulo: 'Não pergunta, deduz' },
];
const FORA: { valor: ForaDosCaminhos; rotulo: string }[] = [
  { valor: 'atender', rotulo: 'Atender mesmo assim' },
  { valor: 'passar', rotulo: 'Passar pro corretor' },
  { valor: 'encerrar', rotulo: 'Encerrar com educação' },
];
const SEM_PERGUNTA = 'Com um caminho só ela não pergunta. Escreva aqui se quiser que ela abra com uma pergunta.';
const MAXIMO_GUARDADOS = 8;
const MAXIMO_MARCADOS = 5;

export default function Intencao({ agent, gravar }: PropsDaPagina) {
  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const modo = (playbook.intent_question_mode as IntentQuestionMode | undefined) ?? 'always';
  const caminhos: CaminhoDaIntencao[] = vars.caminhos_intencao?.length ? vars.caminhos_intencao : (agent.intent_paths ?? []);
  const marcados = caminhos.filter((c) => c.ativo !== false).length;
  const fora = vars.fora_dos_caminhos ?? 'atender';

  const gravarCaminhos = (lista: CaminhoDaIntencao[] | undefined) =>
    gravar({ playbook: { ...playbook, vars: { ...vars, caminhos_intencao: lista } } }, ['playbook.vars.caminhos_intencao']);
  const trocar = (i: number, p: Partial<CaminhoDaIntencao>) => gravarCaminhos(caminhos.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <Secoes>
      <Secao titulo="Pergunta de intenção" descricao="A pergunta que separa os leads logo no começo. Com dois caminhos ou mais marcados, a resposta decide qual ela segue.">
        <BotoesDeEscolha rotulo="Quando perguntar" valor={modo} opcoes={MODOS}
          aoEscolher={(m) => void gravar({ playbook: { ...playbook, intent_question_mode: m === 'always' ? undefined : m } }, ['playbook.intent_question_mode'])} />
        {modo !== 'never' && (
          <TextoNaHora id="intencao-pergunta" rotulo="Pergunta" salvo={agent.intent_question ?? ''}
            placeholder={agent.intent_question_default ?? SEM_PERGUNTA}
            aoGravar={(v) => gravar({ intent_question: v.trim() ? v : null })} />
        )}
      </Secao>

      <Secao titulo="Caminhos" descricao="Marque os que fazem sentido pra esta imobiliária. Com dois ou mais, ela descobre qual é o do lead. Com um só, ela conduz direto por ele.">
        <ol className="divide-y divide-border rounded-xl border border-border bg-background">
          {caminhos.map((c, i) => {
            const marcado = c.ativo !== false;
            return (
              <li key={c.chave ?? `proprio-${i}`} className="flex flex-wrap items-start gap-3 p-3.5">
                <Checkbox id={`caminho-${i}-marcado`} aria-label={`Marcar o caminho ${c.nome}`} className="mt-8" checked={marcado}
                  disabled={!marcado && marcados >= MAXIMO_MARCADOS}
                  onCheckedChange={(v) => void trocar(i, { ativo: v === true })} />
                <TextoNaHora id={`caminho-${i}-nome`} rotulo="Caminho" salvo={c.nome} maxLength={40} className="w-44"
                  aoGravar={(v) => (v.trim() ? trocar(i, { nome: v.trim() }) : undefined)} />
                <TextoNaHora id={`caminho-${i}-sinais`} tipo="varias" rows={3} rotulo={`Como reconhecer o caminho ${c.nome}`}
                  salvo={c.sinais ?? ''} maxLength={300} className="min-w-[12rem] flex-1"
                  aoGravar={(v) => trocar(i, { sinais: v.trim() })} />
                <TextoNaHora id={`caminho-${i}-como`} tipo="varias" rows={3} rotulo="Como ela conduz" salvo={c.como} maxLength={700}
                  className="min-w-[15rem] flex-[2]" aoGravar={(v) => trocar(i, { como: v.trim() })} />
                {!c.chave && (
                  <Button type="button" variant="ghost" size="icon" className="mt-7" aria-label={`Remover o caminho ${c.nome}`}
                    onClick={() => void gravarCaminhos(caminhos.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground">Quem ainda não sabe o que quer, ela sempre atende sem pressão. Não precisa marcar.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" className="text-primary" aria-label="Novo caminho" disabled={caminhos.length >= MAXIMO_GUARDADOS}
            onClick={() => void gravarCaminhos([...caminhos, { nome: 'Novo caminho', sinais: '', como: '', ativo: false }])}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Novo caminho
          </Button>
          <span className="text-xs text-muted-foreground">Até {MAXIMO_MARCADOS} marcados</span>
          {!!vars.caminhos_intencao?.length && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => void gravarCaminhos(agent.intent_paths_padrao)}>Voltar ao padrão</Button>
          )}
        </div>
      </Secao>

      <Secao titulo="Lead que não cabe em nenhum caminho" descricao="Quando ele deixa claro que busca outra coisa. Ex.: a incorporadora só quer quem vai morar e chega um investidor.">
        <BotoesDeEscolha rotulo="O que ela faz" valor={fora} opcoes={FORA}
          aoEscolher={(v) => void gravar({ playbook: { ...playbook, vars: { ...vars, fora_dos_caminhos: v === 'atender' ? undefined : v } } }, ['playbook.vars.fora_dos_caminhos'])} />
      </Secao>
    </Secoes>
  );
}
