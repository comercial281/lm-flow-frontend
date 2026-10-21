// Bastidores: o que a IA está entendendo do lead, em letra grande (a tela é
// compartilhada na call). Mostra etapa, temperatura, caminho, respostas da
// qualificação e o resumo. Quando a IA decide passar pro corretor, o cartão do
// repasse aparece: na Sala o repasse é só indicado, nada é enviado.
import { Card } from '@/components/ui/ds';
import { Aviso } from '@/components/base';
import type { Backstage } from '@/types/demoRoom';

export interface BastidoresProps {
  behind: Backstage | null;
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
  const temDado = !!behind && (
    !!behind.stage_name || !!behind.temperature || !!behind.caminho || !!behind.summary
    || behind.checklist.some(i => !!i.resposta) || !!behind.handoff
  );

  return (
    <section aria-label="Bastidores" data-testid="bastidores" className="space-y-4">
      <h2 className="text-xl font-semibold">O que a IA entendeu do lead</h2>
      {!behind || !temDado ? (
        <Card className="p-5"><p className="text-lg text-muted-foreground">A IA ainda está conhecendo o lead</p></Card>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Dado rotulo="Etapa do funil" valor={behind.stage_name} />
              <Dado rotulo="Temperatura" valor={behind.temperature} />
              <Dado rotulo="Caminho" valor={behind.caminho} />
            </div>
            {behind.checklist.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Respostas da qualificação</p>
                <ul className="space-y-1">
                  {behind.checklist.map(i => (
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
          {behind.handoff && (
            <Aviso tom="sucesso" titulo="Aqui a IA passaria o lead pro corretor">
              <div className="space-y-3 text-lg">
                <div>
                  <p className="text-sm opacity-80">O que o corretor receberia</p>
                  <p>{behind.handoff.summary}</p>
                </div>
                <div>
                  <p className="text-sm opacity-80">Por que</p>
                  <p>{behind.handoff.reason}</p>
                </div>
              </div>
            </Aviso>
          )}
        </>
      )}
    </section>
  );
}
