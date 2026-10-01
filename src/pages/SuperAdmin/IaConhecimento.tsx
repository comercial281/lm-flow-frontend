import CerebroUniversal from './CerebroUniversal';
import PrincipiosIA from './PrincipiosIA';
import SdrRefinement from './SdrRefinement';

/**
 * IA Vendedora → Conhecimento: o que a IA sabe (Cérebro Universal), o que ela
 * segue em toda imobiliária (Princípios) e como ela melhora (Aperfeiçoamento).
 * Eram três abas; aqui ficam uma embaixo da outra, cada uma com o título dela.
 */
export default function IaConhecimento() {
  return (
    <div className="divide-y divide-border">
      <CerebroUniversal />
      <section className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Princípios</h2>
        <PrincipiosIA />
      </section>
      <SdrRefinement />
    </div>
  );
}
