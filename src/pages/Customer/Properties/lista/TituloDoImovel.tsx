// src/pages/Customer/Properties/lista/TituloDoImovel.tsx
// O nome do imóvel na linha e no card. Abre o cadastro só para quem pode editar:
// sem a permissão, o formulário abriria e o Salvar seria recusado.
// Ao lado, a setinha abre a página do imóvel no site numa aba nova (só quando
// o imóvel está no site; fora dele a página não existe).
import { ArrowUpRight } from 'lucide-react';

export default function TituloDoImovel({ texto, podeEditar, aoAbrir, aoAbrirNoSite, className }: {
  texto: string; podeEditar: boolean; aoAbrir: () => void; aoAbrirNoSite?: () => void; className: string;
}) {
  const nome = podeEditar
    ? <button type="button" onClick={aoAbrir} className={`min-w-0 text-left hover:text-primary ${className}`}>{texto}</button>
    : <p className={`min-w-0 ${className}`}>{texto}</p>;
  if (!aoAbrirNoSite) return nome;
  return (
    <div className="flex items-start gap-1">
      {nome}
      <button type="button" onClick={aoAbrirNoSite} aria-label="Abrir no site" title="Abrir no site"
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-primary">
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}
