// Público-alvo e produto (Tarefa 72, 01/11/2026): o que ela vende e pra quem. Entrega BLOCOS (a
// moldura é o Card da página). Tudo grava na hora.
//
// ⚠️ Produto = as marcas (`serves`). A tela manda SÓ `serves`, nunca `locacao_enabled` junto
// (a marca Locação é a chave; o campo antigo está em CAMPOS_ESCONDIDOS). A contagem "N no cadastro"
// vem do servidor (`agent.catalog_marks`); a tela só mostra.
// ⚠️ Os conhecimentos de fábrica que a marca liga: o espelho (`conhecimentosLigados`) responde na
// hora; depois de gravar, vale o que o SERVIDOR devolve (`conhecimentosDeFabrica`).
// ⚠️ Público-alvo = as 4 caixinhas de fábrica da intenção. Mexem SÓ no `ativo` do caminho de
// fábrica dentro de `playbook.vars.caminhos_intencao`; caminho próprio do cliente não aparece e
// nunca é apagado (o servidor guarda a lista crua e só lê o catálogo no comando).
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import {
  salesAgentsService, type CaminhoDaIntencao, type ConhecimentoDeFabrica, type ForaDosCaminhos, type IntentQuestionMode, type Marca, type PlaybookVars,
} from '@/services/salesAgents/salesAgentsService';
import { propertiesService } from '@/services/properties/propertiesService';
import { fraseDaIntencao, INTENCOES, intencoesMarcadas, ROTULO_DA_INTENCAO } from '@/features/salesAgents/intencao';
import { conhecimentosLigados, MARCAS, ROTULO_DA_MARCA, TITULO_DO_CONHECIMENTO } from '@/features/salesAgents/marcas';
import TextoNaHora from '../TextoNaHora';
import type { PropsDaPagina } from '../paginas';

const MODOS: { valor: IntentQuestionMode; rotulo: string }[] = [
  { valor: 'always', rotulo: 'Sempre pergunta' },
  { valor: 'opening_only', rotulo: 'Só se ela abrir a conversa' },
  { valor: 'never', rotulo: 'Não pergunta, deduz' },
];
const FORA: { valor: ForaDosCaminhos; rotulo: string; descricao: string }[] = [
  { valor: 'passar', rotulo: 'Passa pro corretor', descricao: 'Vai pro destino (roleta ou corretor), com o aviso.' },
  { valor: 'encerrar', rotulo: 'Encerra com educação', descricao: 'Diz pra quem o atendimento é pensado e deixa a porta aberta.' },
  { valor: 'atender', rotulo: 'Segue atendendo', descricao: 'Atende como se não houvesse regra.' },
];
const SEM_PERGUNTA = 'Com um caminho só ela não pergunta. Escreva aqui se quiser que ela abra com uma pergunta.';
const MAXIMO_MARCADOS = 5;

/** Os 4 de fábrica "como o servidor lê" quando a lista ainda não veio: Moradia e Investimento marcados. */
const DE_FABRICA: CaminhoDaIntencao[] = INTENCOES.map((k) => ({ chave: k, nome: ROTULO_DA_INTENCAO[k], como: '', ativo: k === 'moradia' || k === 'investimento' }));

function Caixa({ rotulo, marcada, desabilitada, nota, aoMudar }: {
  rotulo: string; marcada: boolean; desabilitada?: boolean; nota?: string; aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <Checkbox checked={marcada} disabled={desabilitada} aria-label={rotulo} onCheckedChange={(v) => aoMudar(v === true)} />
      <span>{rotulo}</span>
      {nota && <span className="text-xs text-muted-foreground">{nota}</span>}
    </label>
  );
}

export default function PublicoEProduto({ agent, gravar }: PropsDaPagina) {
  // null = a lista ainda não chegou (ou falhou): aí não dá pra dizer que o código salvo está
  // "fora dos ativos" — ele aparece sozinho, sem o aviso.
  const [imoveis, setImoveis] = useState<{ code: string; title: string }[] | null>(null);
  useEffect(() => {
    let vivo = true;
    propertiesService.list({ status: 'active', per_page: 100 })
      .then((res) => { if (vivo) setImoveis((res.data ?? []).map((p) => ({ code: p.code, title: p.title }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Marcas e conhecimentos. A resposta do servidor só vale pra marca/desligados que ela leu.
  const serves: Marca[] = agent.serves ?? [];
  const desligados = agent.factory_knowledge_off ?? [];
  const chaveDosConhecimentos = `${agent.id}|${serves.join(',')}|${desligados.join(',')}`;
  const [doServidor, setDoServidor] = useState<{ chave: string; lista: ConhecimentoDeFabrica[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    salesAgentsService.conhecimentosDeFabrica(agent.id)
      .then((lista) => { if (vivo) setDoServidor({ chave: chaveDosConhecimentos, lista }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [agent.id, chaveDosConhecimentos]);
  const nomesLigados = doServidor && doServidor.chave === chaveDosConhecimentos
    ? doServidor.lista.filter((c) => c.enabled).map((c) => c.title)
    : conhecimentosLigados(serves).filter((t) => !desligados.includes(t)).map((t) => TITULO_DO_CONHECIMENTO[t]);

  const mudarMarca = (marca: Marca, ligada: boolean) => {
    const proximas = MARCAS.filter((m) => (m === marca ? ligada : serves.includes(m)));
    if (proximas.length === 0) return undefined; // a última não desmarca
    return gravar({ serves: proximas });
  };

  // Imóvel principal.
  const codigo = agent.default_property_code ?? '';
  const naLista = !!codigo && !!imoveis?.some((i) => i.code === codigo);

  // Público-alvo.
  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;
  const modo = (playbook.intent_question_mode as IntentQuestionMode | undefined) ?? 'always';
  const caminhos: CaminhoDaIntencao[] = vars.caminhos_intencao?.length ? vars.caminhos_intencao : (agent.intent_paths?.length ? agent.intent_paths : DE_FABRICA);
  const marcadosNoTotal = caminhos.filter((c) => c.ativo !== false).length;
  const frase = fraseDaIntencao(intencoesMarcadas(caminhos), 'desta IA');
  const fora = vars.fora_dos_caminhos ?? agent.fora_dos_caminhos_padrao ?? 'passar';
  const mudarCaminho = (chave: string, ativo: boolean) =>
    gravar({ playbook: { ...playbook, vars: { ...vars, caminhos_intencao: caminhos.map((c) => (c.chave === chave ? { ...c, ativo } : c)) } } }, ['playbook.vars.caminhos_intencao']);

  return (
    <Secoes>
      <Secao titulo="Produto" descricao="O que a casa vende. Já vem do cadastro, e cada marca liga os conhecimentos de fábrica dela.">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {MARCAS.map((m) => (
            <li key={m}>
              <Caixa rotulo={ROTULO_DA_MARCA[m]} marcada={serves.includes(m)} desabilitada={serves.includes(m) && serves.length === 1}
                nota={`${agent.catalog_marks?.[m] ?? 0} no cadastro`} aoMudar={(v) => void mudarMarca(m, v)} />
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
          {`Conhecimentos de fábrica ligados: ${nomesLigados.length ? nomesLigados.join(', ') : 'nenhum'}.`}
        </p>
        <p className="text-xs text-muted-foreground">Pelo menos uma marca fica marcada. Pedido fora delas, a IA passa pro corretor, com o aviso.</p>
      </Secao>

      <Secao titulo="Imóvel principal" descricao="Pra IA de um empreendimento só: ela sempre fala dele, mesmo sem código na mensagem.">
        <Campo id="publico-imovel" rotulo="Imóvel principal">
          <Seletor id="publico-imovel" className={`${CLASSE_DO_CAMPO} w-full`} value={codigo}
            onChange={(e) => void gravar({ default_property_code: e.target.value || null })}>
            <option value="">Nenhum: ela descobre pelo anúncio</option>
            {codigo && !naLista && <option value={codigo}>{imoveis ? `${codigo} (não está entre os ativos)` : codigo}</option>}
            {(imoveis ?? []).map((i) => <option key={i.code} value={i.code}>{i.code} · {i.title}</option>)}
          </Seletor>
        </Campo>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border-[1.5px] border-border bg-background p-3.5">
            <LinhaComChave rotulo="Consultar o cadastro" descricao="Busca imóveis cadastrados pra responder."
              ligada={agent.catalog_search_enabled !== false} aoMudar={(v) => gravar({ catalog_search_enabled: v })} />
          </div>
          <div className="rounded-2xl border-[1.5px] border-border bg-background p-3.5">
            <LinhaComChave rotulo="Oferecer outras opções" descricao="Quando o imóvel do anúncio não serve."
              ligada={agent.cross_sell_enabled !== false} aoMudar={(v) => gravar({ cross_sell_enabled: v })} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Público-alvo" descricao="O padrão quando o imóvel não diz pra quem serve. Com dois caminhos ou mais, ela descobre qual é o do lead; com um só, conduz direto por ele.">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {INTENCOES.map((k) => {
            const marcada = caminhos.some((c) => c.chave === k && c.ativo !== false);
            return (
              <li key={k}>
                <Caixa rotulo={ROTULO_DA_INTENCAO[k]} marcada={marcada} desabilitada={!marcada && marcadosNoTotal >= MAXIMO_MARCADOS}
                  aoMudar={(v) => void mudarCaminho(k, v)} />
              </li>
            );
          })}
        </ul>
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">{frase.texto}</p>
        <p className="text-xs text-muted-foreground">Quem ainda não sabe o que quer, ela sempre atende sem pressão. Não precisa marcar. O detalhe de cada imóvel e de cada campanha vale mais que este padrão.</p>
        <BotoesDeEscolha rotulo="Quando perguntar" valor={modo} opcoes={MODOS}
          aoEscolher={(m) => void gravar({ playbook: { ...playbook, intent_question_mode: m === 'always' ? undefined : m } }, ['playbook.intent_question_mode'])} />
        {modo !== 'never' && (
          <TextoNaHora id="publico-pergunta" rotulo="Pergunta" salvo={agent.intent_question ?? ''}
            placeholder={agent.intent_question_default ?? SEM_PERGUNTA}
            aoGravar={(v) => gravar({ intent_question: v.trim() ? v : null })} />
        )}
      </Secao>

      <Secao titulo="Lead fora do perfil do imóvel" descricao="Quando ele conta uma intenção que nenhum caminho serve. Ex.: a incorporadora só quer quem vai morar e chega um investidor. Quem ainda não sabe o que quer não é este caso.">
        <CartoesDeEscolha<ForaDosCaminhos> rotulo="O que ela faz" valor={fora} opcoes={FORA} colunas={3}
          aoEscolher={(v) => void gravar({ playbook: { ...playbook, vars: { ...vars, fora_dos_caminhos: v } } }, ['playbook.vars.fora_dos_caminhos'])} />
      </Secao>
    </Secoes>
  );
}
