import type { ReactNode } from 'react';

// O balão verde do WhatsApp, só leitura: o que sairia pro lead. As cores são as
// do celular do Testar da IA Vendedora (TestarJanela), sem o celular inteiro.
// `*negrito*` aparece em negrito, como no WhatsApp.

const NEGRITO = /\*([^*\n]+)\*/g;

/** "Oi *Rodrigo*" → ["Oi ", <strong>Rodrigo</strong>]. */
export function comNegrito(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  let desde = 0;
  for (const achado of texto.matchAll(NEGRITO)) {
    const inicio = achado.index ?? 0;
    if (inicio > desde) partes.push(texto.slice(desde, inicio));
    partes.push(<strong key={inicio}>{achado[1]}</strong>);
    desde = inicio + achado[0].length;
  }
  if (desde < texto.length) partes.push(texto.slice(desde));
  return partes;
}

export function BolhaDoWhatsapp({ texto, nome }: { texto: string; /** Nome de quem recebe, no topo da conversa. */ nome?: string }) {
  const quem = (nome ?? '').trim();
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {quem && (
        <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white">
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-900">
            {quem.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-[13px] font-semibold">{quem}</span>
        </div>
      )}
      <div className="flex flex-col bg-[#ece5dc] px-3 py-3">
        <div
          data-testid="bolha-do-whatsapp"
          className="max-w-[85%] self-end rounded-[10px_10px_2px_10px] bg-[#d9fdd3] px-2.5 py-1.5 text-[13px] leading-snug text-[#111]"
        >
          <p className="whitespace-pre-wrap break-words">{comNegrito(texto)}</p>
        </div>
      </div>
    </div>
  );
}
