import { useEffect, useState } from 'react';
import { useSlideshow } from '../../../features/siteBuilder/public/useSlideshow';

const FADE_MS = 1000;

/**
 * Foto(s) do fundo da capa. Uma só: o mesmo `<img>` de sempre. Várias: ficam empilhadas; a que sai
 * fica embaixo (opaca) e a que entra faz fade por cima, então o fundo nunca aparece no meio da troca.
 * Montam só a ativa, a próxima (carrega antes de entrar) e a que acabou de sair (some depois do fade).
 * `prioridade` = foto da dobra (fetchPriority).
 */
export default function FundoDaCapa({ fotos, prioridade = false }: { fotos: string[]; prioridade?: boolean }) {
  const n = fotos.length;
  const ativa = useSlideshow(n);
  // "Prop anterior" calculada no render (sem useEffect): a que saiu continua montada no mesmo commit da troca.
  const [visto, setVisto] = useState({ ativa, anterior: null as number | null });
  if (visto.ativa !== ativa) setVisto({ ativa, anterior: visto.ativa });
  const anterior = visto.ativa !== ativa ? visto.ativa : visto.anterior;

  useEffect(() => {
    if (visto.anterior === null) return;
    const id = setTimeout(() => setVisto(v => ({ ...v, anterior: null })), FADE_MS + 100);
    return () => clearTimeout(id);
  }, [visto.anterior, visto.ativa]);

  if (n < 2) {
    return <img src={fotos[0]} alt="" fetchPriority={prioridade ? 'high' : undefined} className="h-full w-full object-cover" />;
  }

  const montadas = new Set([ativa, (ativa + 1) % n]);
  if (anterior !== null && anterior < n) montadas.add(anterior);
  // `isolate`: o z-index das fotos fica só aqui dentro e não passa por cima do filtro e do texto da capa.
  return (
    <div className="relative isolate h-full w-full">
      {fotos.map((src, i) => montadas.has(i) && (
        <img
          key={i}
          src={src}
          alt=""
          fetchPriority={i === 0 && prioridade ? 'high' : undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
            i === ativa ? 'z-10 opacity-100' : i === anterior ? 'z-0 opacity-100' : 'z-0 opacity-0'}`}
        />
      ))}
    </div>
  );
}
