import { CORPO_SECAO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { BaseDeConhecimento, EscolaDeVendas } from './CerebroUniversal';
import PrincipiosIA from './PrincipiosIA';
import SdrRefinement from './SdrRefinement';

/**
 * IA Vendedora → Conhecimento: o que a IA sabe (Base de conhecimento e Escola de
 * vendas, o antigo Cérebro Universal), o que ela segue em toda imobiliária
 * (Princípios) e como ela melhora (Aperfeiçoamento). Quatro seções com o quadro
 * padrão, uma embaixo da outra; nenhuma aba dentro de aba (06/10/2026).
 */
export default function IaConhecimento() {
  return (
    <div className={`mx-auto max-w-5xl px-4 py-6 ${PAGINA}`}>
      <BaseDeConhecimento />
      <EscolaDeVendas />
      <section aria-labelledby="principios" className={SECAO}>
        <h2 id="principios" className={TITULO_SECAO}>Princípios</h2>
        <p className={SUBTITULO_SECAO}>
          O comando da IA Vendedora: o alicerce da venda e as regras da casa. Editado aqui, vale para as IAs de todos os clientes.
        </p>
        <div className={CORPO_SECAO}>
          <PrincipiosIA />
        </div>
      </section>
      <SdrRefinement />
    </div>
  );
}
