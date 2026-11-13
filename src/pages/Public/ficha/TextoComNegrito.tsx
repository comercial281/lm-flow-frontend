import { trechosComNegrito } from '@/features/siteBuilder/public/negritoNaDescricao';

/** Texto da descrição com o **negrito** escrito à mão virando <strong> (e nada mais: HTML sai como texto). */
export default function TextoComNegrito({ texto, classeDoNegrito }: { texto: string; classeDoNegrito?: string }) {
  return (
    <>
      {trechosComNegrito(texto).map((t, i) => (t.negrito ? <strong key={i} className={classeDoNegrito}>{t.texto}</strong> : t.texto))}
    </>
  );
}
