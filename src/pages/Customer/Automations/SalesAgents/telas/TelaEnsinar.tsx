// Ensinar: Base de Conhecimento + Aprendizado numa página só (decisão do Tony,
// 04–05/10). As duas partes são as abas de antes, movidas sem mudança. Instruções,
// exemplos de conversa e prova social continuam em Configurar até a entrega 2.
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { KnowledgeTab } from './ensinar/BaseDeConhecimento';
import { LearningTab } from './ensinar/Aprendizado';

export default function TelaEnsinar({ agent, onCountChange }: { agent: SalesAgent; onCountChange: () => void }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="ensinar-sabe" className="space-y-3">
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
