// Passo 3 · Roteiro. Primeira mensagem (com as variações por campanha dentro), as
// PERGUNTAS (o centro do roteiro: as obrigatórias são o que mais funciona hoje) e o
// que ela não faz.
//
// ⚠️ "Com um texto meu de base": no roteiro de hoje o `greeting` é referência de
// tom, não texto literal. O texto exato chega com o roteiro novo (entrega 4).
//
// ⚠️ Perguntas e textos de lista vivem num estado local enquanto a pessoa digita
// (linha em branco recém-adicionada não pode sumir); o rascunho recebe a versão limpa.
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import type { IntentQuestionMode, PlaybookVars, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { perguntasDoAgente, perguntasParaPatch, type Pergunta } from '@/features/salesAgents/perguntas';
import { plural } from '@/lib/formato';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDaIa';
import { Aviso, Caixa, CascaDoPasso, Escolha, type OpcaoDeEscolha } from '../pecas';
import { ListaDePerguntas } from '../ListaDePerguntas';
import { CampoDeMidia } from '../CampoDeMidia';
import { VariacoesPorCampanha } from '../VariacoesPorCampanha';
import type { PropsDoPasso } from '../passos';

type ModoAbertura = 'ia' | 'base';
// Um lugar só pra ler o modo salvo (era o ponto que o "texto exato", cortado em 05/10, trocaria;
// função e a lista MODOS).
const modoInicial = (a: SalesAgent): ModoAbertura => (a.greeting ? 'base' : 'ia');
const MODOS: OpcaoDeEscolha<ModoAbertura>[] = [
  { valor: 'ia', titulo: 'A IA monta', descricao: 'Ela se apresenta, cita o anúncio de onde o lead veio e puxa a conversa.' },
  { valor: 'base', titulo: 'Com um texto meu de base', descricao: 'Ela usa o seu texto como modelo, trocando pelo nome do lead e pelo anúncio.' },
];
const INTENCAO: OpcaoDeEscolha<IntentQuestionMode>[] = [
  { valor: 'always', titulo: 'Sempre', descricao: 'Pergunta e volta ao assunto se o lead desviar.' },
  { valor: 'opening_only', titulo: 'Só se a IA abrir a conversa', descricao: 'Pergunta só quando a primeira mensagem é dela. Depois deduz pelo que o lead fala.' },
  { valor: 'never', titulo: 'Não, ela deduz pela conversa', descricao: 'Não pergunta: vai direto pras perguntas da lista.' },
];
const PERGUNTA_PADRAO = 'Queria entender de fato o que você está buscando: seu foco é moradia, investimento, ou ainda não sabe e tá só sondando?';
const LIMITES: [('address' | 'discount' | 'price' | 'iptu'), string][] = [
  ['address', 'Passar o endereço exato do imóvel'],
  ['discount', 'Negociar desconto'],
  ['price', 'Fechar preço final ou proposta'],
  ['iptu', 'Informar o IPTU'],
];

export default function Passo3Roteiro({ agent, aoSalvo, irParaPasso }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[3], aoSalvo);
  const [modo, setModo] = useState<ModoAbertura>(() => modoInicial(agent));
  const [perguntas, setPerguntas] = useState<Pergunta[]>(() => perguntasDoAgente(agent));
  const [outrosLimites, setOutrosLimites] = useState((agent.ai_limits?.custom ?? []).join('\n'));

  useEffect(() => {
    setModo(modoInicial(agent));
    setPerguntas(perguntasDoAgente(agent));
    setOutrosLimites((agent.ai_limits?.custom ?? []).join('\n'));
  }, [agent]);

  const playbook = rascunho.playbook ?? {};
  const intencao = (playbook.intent_question_mode as IntentQuestionMode | undefined) ?? 'always';
  const limites = rascunho.ai_limits ?? {};
  const daSituacao = ((agent.playbook?.vars as PlaybookVars | undefined)?.perguntas_situacao ?? []).filter((q) => q.trim());
  const seguraOLead = rascunho.transfer_config?.mode === 'checklist';

  const trocarPerguntas = (lista: Pergunta[]) => {
    setPerguntas(lista);
    mudar(perguntasParaPatch(lista, rascunho));
  };
  const escolherModo = (m: ModoAbertura) => {
    setModo(m);
    if (m === 'ia') mudar({ greeting: null });
  };
  const descartarTudo = () => {
    descartar();
    setModo(modoInicial(agent));
    setPerguntas(perguntasDoAgente(agent));
    setOutrosLimites((agent.ai_limits?.custom ?? []).join('\n'));
  };

  const previa = useMemo(() => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Primeira mensagem</p>
      <p className="ml-auto max-w-[90%] rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50">
        {rascunho.greeting?.trim() || 'Ela se apresenta, cita o anúncio de onde o lead veio e puxa a conversa.'}
      </p>
      {rascunho.opening_image_url && <p className="text-xs text-muted-foreground">+ imagem de abertura</p>}
      {rascunho.opening_audio_url && <p className="text-xs text-muted-foreground">+ áudio de abertura</p>}
      {intencao !== 'never' && (
        <p className="ml-auto max-w-[90%] rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50">
          {rascunho.intent_question?.trim() || PERGUNTA_PADRAO}
        </p>
      )}
    </div>
  ), [rascunho.greeting, rascunho.opening_image_url, rascunho.opening_audio_url, rascunho.intent_question, intencao]);

  return (
    <CascaDoPasso numero={3} previa={previa} pendente={pendente} salvando={salvando} erro={erro}
      aoSalvar={() => void salvar()} aoDescartar={descartarTudo}>
      <Secao titulo="Primeira mensagem" descricao="Como ela abre a conversa com quem veio do anúncio.">
        <Aviso tom="neutro">Vale quando o lead escreve primeiro. Lead de formulário recebe a mensagem da automação.</Aviso>
        <Escolha nome="abertura" legenda="Primeira mensagem" valor={modo} opcoes={MODOS} aoEscolher={escolherModo} />
        {modo === 'base' && (
          <CampoTextoLongo id="p3-texto-base" rotulo="Texto de base" rows={3} valor={rascunho.greeting ?? ''}
            aoMudar={(v) => mudar({ greeting: v.trim() ? v : null })} />
        )}
        <CampoTexto id="p3-origem" rotulo="Quando não souber o anúncio, ela diz que o lead veio de" valor={rascunho.default_origin ?? ''}
          placeholder="nosso anúncio do Instagram" aoMudar={(v) => mudar({ default_origin: v.trim() ? v : null })} />
        <CampoDeMidia id="p3-imagem" agentId={agent.id} tipo="image" rotulo="Imagem de abertura" valor={rascunho.opening_image_url}
          aoMudar={(url) => mudar({ opening_image_url: url })} />
        <CampoDeMidia id="p3-audio" agentId={agent.id} tipo="audio" rotulo="Áudio de abertura" valor={rascunho.opening_audio_url}
          aoMudar={(url) => mudar({ opening_audio_url: url })} />
        <VariacoesPorCampanha agentId={agent.id} variacoes={rascunho.openings ?? []} aoMudar={(v) => mudar({ openings: v })} />
      </Secao>

      {/* Sem a chave `ia_playbook`: até aqui este controle só existia dentro do
          PlaybookSection (travado), e a queixa do dono do produto era justamente
          "ela sempre pergunta". Grava só `playbook.intent_question_mode`. */}
      <Secao titulo="Perguntar se é pra morar ou investir"
        descricao="Com 'Sempre', ela pergunta mesmo depois da primeira mensagem da automação do formulário.">
        <Escolha nome="intencao" legenda="Perguntar se é pra morar ou investir" valor={intencao} opcoes={INTENCAO}
          aoEscolher={(v) => mudar({ playbook: { ...playbook, intent_question_mode: v === 'always' ? undefined : v } })} />
        {intencao !== 'never' && (
          <CampoTextoLongo id="p3-intencao" rotulo="Texto da pergunta" rows={2} valor={rascunho.intent_question ?? ''}
            placeholder={PERGUNTA_PADRAO} aoMudar={(v) => mudar({ intent_question: v.trim() ? v : null })} />
        )}
      </Secao>

      <Secao titulo="Perguntas" descricao="O que ela precisa descobrir, uma por vez. As obrigatórias seguram o lead até serem respondidas.">
        <ListaDePerguntas perguntas={perguntas} aoMudar={trocarPerguntas} />
        {!seguraOLead && (
          <Aviso tom="neutro">
            <p>As obrigatórias só seguram o lead com "Só depois das perguntas obrigatórias", no passo Objetivo.</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => irParaPasso(2)}>Abrir Objetivo</Button>
          </Aviso>
        )}
        {daSituacao.length > 0 && (
          <Aviso tom="neutro">
            Esta IA também tem {plural(daSituacao.length, 'pergunta', 'perguntas')} no roteiro de hoje ({daSituacao.join(' · ')}).
            Elas continuam valendo e entram nesta lista quando o roteiro novo for ligado.
          </Aviso>
        )}
      </Secao>

      <Secao titulo="O que ela não faz" descricao="Se o lead pedir, ela diz que um corretor confirma.">
        {LIMITES.map(([chave, rotulo]) => (
          <Caixa key={chave} id={`p3-limite-${chave}`} rotulo={rotulo} marcada={!!limites[chave]}
            aoMudar={(v) => mudar({ ai_limits: { ...limites, [chave]: v } })} />
        ))}
        <CampoTextoLongo id="p3-outros-limites" rotulo="Outras coisas que ela não faz (uma por linha)" rows={3} valor={outrosLimites}
          aoMudar={(v) => {
            setOutrosLimites(v);
            mudar({ ai_limits: { ...limites, custom: v.split('\n').map((l) => l.trim()).filter(Boolean) } });
          }} />
      </Secao>
    </CascaDoPasso>
  );
}
