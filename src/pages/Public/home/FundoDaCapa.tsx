import { useEffect, useRef, useState } from 'react';
import { useSlideshow } from '../../../features/siteBuilder/public/useSlideshow';

/**
 * Foto(s) do fundo da capa. Uma só: o mesmo `<img>` de sempre. Várias: ficam empilhadas e a ativa troca
 * com fade. Só montam a ativa, a próxima (que carrega antes de entrar) e a que acabou de sair (pra sumir
 * com fade em vez de cortar); as outras entram quando chegar a vez. `prioridade` = foto da dobra (fetchPriority).
 */
export default function FundoDaCapa({ fotos, prioridade = false }: { fotos: string[]; prioridade?: boolean }) {
  const n = fotos.length;
  const ativa = useSlideshow(n);
  // A que acabou de sair fica montada o tempo do fade.
  const [anterior, setAnterior] = useState<number | null>(null);
  const ultima = useRef(ativa);
  useEffect(() => {
    if (ultima.current !== ativa) { setAnterior(ultima.current); ultima.current = ativa; }
  }, [ativa]);

  if (n < 2) {
    return <img src={fotos[0]} alt="" fetchPriority={prioridade ? 'high' : undefined} className="h-full w-full object-cover" />;
  }

  const montadas = new Set([ativa, (ativa + 1) % n]);
  if (anterior !== null && anterior < n) montadas.add(anterior);
  return (
    <div className="relative h-full w-full">
      {fotos.map((src, i) => montadas.has(i) && (
        <img
          key={i}
          src={src}
          alt=""
          fetchPriority={i === 0 && prioridade ? 'high' : undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none ${i === ativa ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </div>
  );
}
