// src/pages/Customer/Properties/lista/TituloDoImovel.tsx
// O nome do imóvel na linha e no card. Abre o cadastro só para quem pode editar:
// sem a permissão, o formulário abriria e o Salvar seria recusado.
export default function TituloDoImovel({ texto, podeEditar, aoAbrir, className }: {
  texto: string; podeEditar: boolean; aoAbrir: () => void; className: string;
}) {
  if (!podeEditar) return <p className={className}>{texto}</p>;
  return <button type="button" onClick={aoAbrir} className={`text-left hover:text-primary ${className}`}>{texto}</button>;
}
