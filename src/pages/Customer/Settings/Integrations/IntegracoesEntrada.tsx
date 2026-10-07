import { BaseHeader } from '@/components/base';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { cartoesVisiveis, itemDeIntegracoes, NENHUMA_INTEGRACAO } from './cartoes';
import SeloDoCartao from './SeloDoCartao';
import CartaoDeLink from './CartaoDeLink';

// Minha imobiliária → Integrações (07/10/2026): um cartão por assunto, no lugar
// das cinco abas. Quais aparecem sai da lista do menu já filtrada pelo cargo.
export default function IntegracoesEntrada() {
  const cartoes = cartoesVisiveis(itemDeIntegracoes(useMenuSecoes()));

  return (
    // Mesmo esqueleto das páginas da casa (Canais): cabeçalho padrão e cartões.
    <div className="flex h-full flex-col gap-6 p-4">
      <BaseHeader title="Integrações" subtitle="Conecte o LM Flow às ferramentas que sua imobiliária já usa." />

      {cartoes.length === 0 ? (
        <p className="text-sm text-sidebar-foreground/70">{NENHUMA_INTEGRACAO}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cartoes.map(({ cartao, href }) => (
            <li key={cartao.id}>
              <CartaoDeLink para={href}>
                <SeloDoCartao logo={cartao.logo} icone={cartao.icone} tamanho="grande" />
                <span className="font-semibold text-sidebar-foreground">{cartao.nome}</span>
                <span className="text-sm text-sidebar-foreground/70">{cartao.frase}</span>
              </CartaoDeLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
