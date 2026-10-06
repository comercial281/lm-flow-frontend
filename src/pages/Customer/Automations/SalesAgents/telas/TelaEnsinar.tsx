// Ensinar: Base de Conhecimento + Aprendizado numa página só (decisão do Tony,
// 04–05/10). As duas partes são as abas de antes, movidas sem mudança. Desde a
// entrega 2, também as instruções, a prova social e os exemplos de conversa
// (saíram do Configurar).
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { KnowledgeTab } from './ensinar/BaseDeConhecimento';
import { LearningTab } from './ensinar/Aprendizado';
import EnsinarTextos from '../configurar/EnsinarTextos';

export default function TelaEnsinar({ agent, onCountChange, aoSalvo }: { agent: SalesAgent; onCountChange: () => void; aoSalvo: (a: SalesAgent) => void }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="ensinar-textos" className="space-y-3">
        <div>
          <h2 id="ensinar-textos" className="text-lg font-semibold">Como ela atende</h2>
          <p className="text-sm text-muted-foreground">Suas instruções, casos reais e exemplos de conversa.</p>
        </div>
        <EnsinarTextos agent={agent} aoSalvo={aoSalvo} />
      </section>
      <section aria-labelledby="ensinar-sabe" className="space-y-3 border-t border-sidebar-border pt-8">
        <div>
          <h2 id="ensinar-sabe" className="text-lg font-semibold">O que ela sabe</h2>
          <p className="text-sm text-muted-foreground">Arquivos e textos que ela consulta para responder, e o que ela pode enviar pro lead.</p>
        </div>
        <KnowledgeTab agent={agent} onCountChange={onCountChange} />
      </section>
      <section aria-labelledby="ensinar-regras" className="space-y-3 border-t border-sidebar-border pt-8">
        <div>
          <h2 id="ensinar-regras" className="text-lg font-semibold">Regras e exemplos</h2>
          <p className="text-sm text-muted-foreground">O que você ensinou e as lições aceitas das sugestões. Vale nas próximas conversas.</p>
        </div>
        <LearningTab agent={agent} />
      </section>
    </div>
  );
}
