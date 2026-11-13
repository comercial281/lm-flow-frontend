import { partesDoTitulo, semAsteriscos } from '@/features/siteBuilder/public/destaqueNoTitulo';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';

// Título com o trecho entre asteriscos em destaque. Sem par válido ou com
// modo 'none': texto puro, sem span.
export function TituloComDestaque({ texto, modo, sobreEscuro }: { texto: string; modo: DestaqueDosTitulos; sobreEscuro?: boolean }) {
  const partes = modo === 'none' ? null : partesDoTitulo(texto);
  if (!partes) return <>{semAsteriscos(texto)}</>;
  return (
    <>
      {partes.antes}
      <span data-destaque={modo} data-sobre-escuro={sobreEscuro ? '' : undefined}>{partes.marcado}</span>
      {partes.depois}
    </>
  );
}
