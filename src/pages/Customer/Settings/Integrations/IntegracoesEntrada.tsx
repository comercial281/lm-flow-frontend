import { Link } from 'react-router-dom';
import { Plug } from 'lucide-react';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { cartoesVisiveis, itemDeIntegracoes, NENHUMA_INTEGRACAO } from './cartoes';
import SeloDoCartao from './SeloDoCartao';

// Minha imobiliária → Integrações (07/10/2026): um cartão por assunto, no lugar
// das cinco abas. Quais aparecem sai da lista do menu já filtrada pelo cargo.
export default function IntegracoesEntrada() {
  const cartoes = cartoesVisiveis(itemDeIntegracoes(useMenuSecoes()));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center gap-2">
        <Plug className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">Integrações</h1>
      </header>

      {cartoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NENHUMA_INTEGRACAO}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cartoes.map(({ cartao, href }) => (
            <li key={cartao.id}>
              <Link
                to={href}
                className="flex h-full flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <SeloDoCartao logo={cartao.logo} icone={cartao.icone} tamanho="grande" />
                <span className="font-semibold text-foreground">{cartao.nome}</span>
                <span className="text-sm text-muted-foreground">{cartao.frase}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
