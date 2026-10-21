// Bastidores: o que a IA está entendendo do lead, em letra grande (a tela é
// compartilhada na call). Mostra etapa, temperatura, caminho, intenção, o que a
// IA anotou (região, orçamento...), respostas da qualificação e o resumo. Quando
// a IA decide passar pro corretor, o cartão do repasse aparece: na Sala o
// repasse é só indicado, nada é enviado.
//
// O servidor manda os atributos da conversa crus: qualquer campo pode vir null.
import { Card } from '@/components/ui/ds';
import { Aviso } from '@/components/base';
import { rotuloDaPergunta } from '@/features/salesAgents/ensaio';
import type { Backstage } from '@/types/demoRoom';

export interface BastidoresProps {
  behind: Backstage | null;
}

// Mesmos rótulos do Testar da IA (features/salesAgents/ensaio.ts).
const TEMPERATURA: Record<string, string> = { hot: 'Quente', warm: 'Morna', cold: 'Fria', unknown: 'Ainda não dá pra saber' };

// Mesmos rótulos do painel "O que a IA entendeu" da conversa (AiUnderstandingPanel).
const INTENCAO: Record<string, string> = {
  comprador: 'Procurando imóvel',
  captacao: 'Quer vender/anunciar um imóvel',
  curioso: 'Só curioso',
  spam: 'Spam',
};

// Ordem de leitura do AiUnderstandingPanel; chave fora da lista vai no fim com
// rótulo gerado ("faixa_de_renda" vira "Faixa de renda").
const COLETADO: Array<{ chave: string; rotulo: string }> = [
  { chave: 'motivo', rotulo: 'Por que está procurando' },
  { chave: 'tipo_imovel', rotulo: 'Tipo de imóvel' },
  { chave: 'regiao', rotulo: 'Região' },
  { chave: 'orcamento', rotulo: 'Orçamento' },
  { chave: 'prazo', rotulo: 'Prazo' },
  { chave: 'financiamento', rotulo: 'Financiamento' },
  { chave: 'fgts', rotulo: 'FGTS' },
];

function textoDe(valor: unknown): string {
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

/** O que a IA anotou, já com rótulo e sem valor vazio. */
function dadosColetados(collected: unknown): Array<{ chave: string; rotulo: string; valor: string }> {
  if (!collected || typeof collected !== 'object' || Array.isArray(collected)) return [];
  const obj = collected as Record<string, unknown>;
  const conhecidas = new Set(COLETADO.map(c => c.chave));
  const linhas = [
    ...COLETADO.map(c => ({ chave: c.chave, rotulo: c.rotulo, valor: textoDe(obj[c.chave]) })),
    ...Object.keys(obj).filter(k => !conhecidas.has(k))
      .map(k => ({ chave: k, rotulo: rotuloDaPergunta(k), valor: textoDe(obj[k]) })),
  ];
  return linhas.filter(l => l.valor !== '');
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}

export default function Bastidores({ behind }: BastidoresProps) {
  const checklist = Array.isArray(behind?.checklist) ? behind.checklist : [];
  const coletados = dadosColetados(behind?.collected);
  const temperatura = behind?.temperature ? (TEMPERATURA[behind.temperature] ?? behind.temperature) : null;
  const intencao = behind?.intent ? (INTENCAO[behind.intent] ?? behind.intent) : null;
  const handoff = behind?.handoff ?? null;
  const resumoDoRepasse = handoff?.summary?.trim() || '';
  const motivoDoRepasse = handoff?.reason?.trim() || '';

  const temDado = !!behind && (
    !!behind.stage_name || !!temperatura || !!behind.caminho || !!intencao || !!behind.summary
    || coletados.length > 0 || checklist.some(i => !!i?.resposta) || !!handoff
  );

  return (
    <section aria-label="Bastidores" data-testid="bastidores" className="space-y-4">
      <h2 className="text-xl font-semibold">O que a IA entendeu do lead</h2>
      {!behind || !temDado ? (
        <Card className="p-5"><p className="text-lg text-muted-foreground">A IA ainda está conhecendo o lead</p></Card>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dado rotulo="Etapa do funil" valor={behind.stage_name} />
              <Dado rotulo="Temperatura" valor={temperatura} />
              <Dado rotulo="Caminho" valor={behind.caminho} />
              <Dado rotulo="Intenção" valor={intencao} />
            </div>
            {coletados.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coletados.map(c => <Dado key={c.chave} rotulo={c.rotulo} valor={c.valor} />)}
              </div>
            )}
            {checklist.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Respostas da qualificação</p>
                <ul className="space-y-1">
                  {checklist.map(i => (
                    <li key={i.pergunta} className="flex flex-wrap gap-x-3 text-lg">
                      <span className="text-muted-foreground">{i.pergunta}</span>
                      {i.resposta
                        ? <span className="font-semibold">{i.resposta}</span>
                        : <span className="text-muted-foreground">ainda sem resposta</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {behind.summary && (
              <div>
                <p className="text-sm text-muted-foreground">Resumo</p>
                <p className="text-lg">{behind.summary}</p>
              </div>
            )}
          </Card>
          {handoff && (
            <Aviso tom="sucesso" titulo="Aqui a IA passaria o lead pro corretor">
              <div className="space-y-3 text-lg">
                {resumoDoRepasse && (
                  <div>
                    <p className="text-sm opacity-80">O que o corretor receberia</p>
                    <p>{resumoDoRepasse}</p>
                  </div>
                )}
                {motivoDoRepasse && (
                  <div>
                    <p className="text-sm opacity-80">Por que</p>
                    <p>{motivoDoRepasse}</p>
                  </div>
                )}
              </div>
            </Aviso>
          )}
        </>
      )}
    </section>
  );
}
