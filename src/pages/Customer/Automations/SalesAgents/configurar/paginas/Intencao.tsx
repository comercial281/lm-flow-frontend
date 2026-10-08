// Introdução · Intenção. Caminhos MARCÁVEIS (08/10/2026): o catálogo (Moradia,
// Investimento, Primeiro imóvel, Trocar de imóvel) vem sempre na lista, a
// imobiliária marca o que vale e cria os dela. O servidor monta todo texto de
// intenção só com os marcados: "morar ou investir" só chega à IA com os dois
// marcados; com um só ela não pergunta intenção. Sondando não é caixinha (sempre
// ligado). Lista ausente = padrão (o servidor devolve em `intent_paths`); "Voltar
// ao padrão" grava o padrão do tipo de venda (`intent_paths_padrao`).
// Os caminhos aparecem como CHIPS: o clique no chip marca/desmarca (grava a lista
// inteira na hora) e o lápis abre a janela "Editar caminho", com estado local e uma
// gravação só no Salvar. Caminho novo só entra na lista depois de escrito (nome e
// "Como ela conduz" obrigatórios, que é o que o servidor exige para não descartar).
// A ORDEM da lista nunca muda aqui: o servidor só reconhece "de fábrica" se for
// igual ao catálogo NA ORDEM do catálogo (mapeia no lugar, próprio novo vai ao fim).
import { useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
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
  { valor: 'passar', rotulo: 'Passar pro destino (roleta ou corretor)' },
  { valor: 'atender', rotulo: 'Atender mesmo assim' },
  { valor: 'encerrar', rotulo: 'Encerrar com educação' },
];
const SEM_PERGUNTA = 'Com um caminho só ela não pergunta. Escreva aqui se quiser que ela abra com uma pergunta.';
const MAXIMO_GUARDADOS = 8;
const MAXIMO_MARCADOS = 5;
const iguais = (a: CaminhoDaIntencao[], b: CaminhoDaIntencao[]) =>
  a.length === b.length && a.every((c, i) => {
    const o = b[i];
    return c.chave === o.chave && c.nome === o.nome && (c.sinais ?? '') === (o.sinais ?? '') && c.como === o.como && (c.ativo !== false) === (o.ativo !== false);
  });

// Janela de edição (ou de criação, com `inicial` nulo). Estado local: nada grava até o Salvar.
function JanelaDoCaminho({ inicial, outrosNomes, podeMarcar, aoSalvar, aoRemover, aoFechar }: {
  inicial: CaminhoDaIntencao | null;
  outrosNomes: string[];
  podeMarcar: boolean;
  aoSalvar: (c: CaminhoDaIntencao) => void;
  aoRemover?: () => void;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [sinais, setSinais] = useState(inicial?.sinais ?? '');
  const [como, setComo] = useState(inicial?.como ?? '');
  const [ativo, setAtivo] = useState(inicial ? inicial.ativo !== false : false);
  const repetido = outrosNomes.includes(nome.trim().toLowerCase());
  const valido = !!nome.trim() && !!como.trim() && !repetido;
  const salvar = () => {
    if (!valido) return;
    aoSalvar({ ...inicial, nome: nome.trim(), sinais: sinais.trim(), como: como.trim(), ativo });
  };
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent size="wide">
        <DialogHeader><DialogTitle>{inicial ? 'Editar caminho' : 'Novo caminho'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <CampoTexto id="caminho-nome" rotulo="Nome do caminho" valor={nome} aoMudar={setNome} maxLength={40}
            erro={repetido ? 'Já existe um caminho com esse nome.' : undefined} />
          <CampoTextoLongo id="caminho-sinais" rotulo="Como reconhecer" valor={sinais} aoMudar={setSinais} rows={3} maxLength={300}
            ajuda="Pistas na fala do lead que mostram este caminho." />
          <CampoTextoLongo id="caminho-como" rotulo="Como ela conduz" valor={como} aoMudar={setComo} rows={7} maxLength={700}
            ajuda={!como.trim() ? 'Escreva como ela conduz quem segue este caminho.' : undefined} />
          <div className="flex items-center gap-2">
            <Checkbox id="caminho-marcado" checked={ativo} disabled={!ativo && !podeMarcar} onCheckedChange={(v) => setAtivo(v === true)} />
            <label htmlFor="caminho-marcado" className="text-sm">Marcado</label>
            {!ativo && !podeMarcar && <span className="text-xs text-muted-foreground">Já são {MAXIMO_MARCADOS} marcados</span>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {aoRemover && <Button type="button" variant="outline" className="text-destructive" onClick={aoRemover}>Remover caminho</Button>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
            <Button type="button" disabled={!valido} onClick={salvar}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Intencao({ agent, gravar }: PropsDaPagina) {
  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const modo = (playbook.intent_question_mode as IntentQuestionMode | undefined) ?? 'always';
  const caminhos: CaminhoDaIntencao[] = vars.caminhos_intencao?.length ? vars.caminhos_intencao : (agent.intent_paths ?? []);
  const marcados = caminhos.filter((c) => c.ativo !== false).length;
  const jaNoPadrao = !!agent.intent_paths_padrao && iguais(caminhos, agent.intent_paths_padrao);
  const fora = vars.fora_dos_caminhos ?? agent.fora_dos_caminhos_padrao ?? 'passar';

  const gravarCaminhos = (lista: CaminhoDaIntencao[] | undefined) =>
    gravar({ playbook: { ...playbook, vars: { ...vars, caminhos_intencao: lista } } }, ['playbook.vars.caminhos_intencao']);
  const trocar = (i: number, p: Partial<CaminhoDaIntencao>) => gravarCaminhos(caminhos.map((c, j) => (j === i ? { ...c, ...p } : c)));
  // Janela aberta: índice do caminho em edição, 'novo' ou nada.
  const [janela, setJanela] = useState<number | 'novo' | null>(null);
  const emEdicao = typeof janela === 'number' ? caminhos[janela] : undefined;
  const fechar = () => setJanela(null);
  const salvarJanela = (c: CaminhoDaIntencao) => {
    // Edita no lugar; o novo vai ao fim (a ordem do catálogo nunca muda).
    void gravarCaminhos(typeof janela === 'number' ? caminhos.map((x, j) => (j === janela ? c : x)) : [...caminhos, c]);
    fechar();
  };
  const marcadosFora = caminhos.filter((c, j) => c.ativo !== false && j !== janela).length;
  const nomesFora = caminhos.filter((_, j) => j !== janela).map((c) => c.nome.trim().toLowerCase());
  const resumo = marcados >= 2 ? 'Com dois ou mais marcados, ela pergunta e descobre o caminho.'
    : marcados === 1 ? `Com um marcado, ela conduz direto por ${caminhos.find((c) => c.ativo !== false)?.nome}.`
    : 'Nenhum marcado: ela qualifica pelo que o lead falar.';

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
        <ul className="flex flex-wrap gap-2">
          {caminhos.map((c, i) => {
            const marcado = c.ativo !== false;
            const cheio = !marcado && marcados >= MAXIMO_MARCADOS;
            return (
              <li key={c.chave ?? `proprio-${i}`}
                className={`flex items-center rounded-full border text-sm ${marcado ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                <button type="button" aria-pressed={marcado} aria-label={`Marcar o caminho ${c.nome}`} disabled={cheio}
                  title={cheio ? `Até ${MAXIMO_MARCADOS} marcados: desmarque outro antes` : undefined}
                  className="flex items-center gap-1.5 rounded-l-full py-1.5 pl-3 pr-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void trocar(i, { ativo: !marcado })}>
                  {marcado && <Check className="h-4 w-4" aria-hidden />}
                  {c.nome}
                </button>
                <button type="button" aria-label={`Editar o caminho ${c.nome}`} className="rounded-r-full py-1.5 pl-1 pr-2.5 opacity-80 hover:opacity-100"
                  onClick={() => setJanela(i)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
          <li>
            <Button type="button" variant="outline" className="h-auto rounded-full border-dashed px-3 py-1.5 text-primary" disabled={caminhos.length >= MAXIMO_GUARDADOS}
              onClick={() => setJanela('novo')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Novo caminho
            </Button>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">{resumo}</p>
        <p className="text-sm text-muted-foreground">Quem ainda não sabe o que quer, ela sempre atende sem pressão. Não precisa marcar.</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Até {MAXIMO_MARCADOS} marcados</span>
          {!!vars.caminhos_intencao?.length && !jaNoPadrao && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => void gravarCaminhos(agent.intent_paths_padrao)}>Voltar ao padrão</Button>
          )}
        </div>
      </Secao>

      {janela !== null && (
        <JanelaDoCaminho key={String(janela)} inicial={emEdicao ?? null} outrosNomes={nomesFora} podeMarcar={marcadosFora < MAXIMO_MARCADOS}
          aoSalvar={salvarJanela} aoFechar={fechar}
          aoRemover={emEdicao && !emEdicao.chave ? () => { void gravarCaminhos(caminhos.filter((_, j) => j !== janela)); fechar(); } : undefined} />
      )}

      {marcados > 0 && (
      <Secao titulo="Lead que não cabe em nenhum caminho" descricao="Quando ele deixa claro que busca outra coisa. Ex.: a incorporadora só quer quem vai morar e chega um investidor. Sem escolha, ela passa pro destino quando você mexe nos caminhos.">
        <BotoesDeEscolha rotulo="O que ela faz" valor={fora} opcoes={FORA}
          aoEscolher={(v) => void gravar({ playbook: { ...playbook, vars: { ...vars, fora_dos_caminhos: v } } }, ['playbook.vars.fora_dos_caminhos'])} />
      </Secao>
      )}
    </Secoes>
  );
}
