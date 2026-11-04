// Lê o contrato que está na tela (inclusive o que a pessoa editou à mão) e devolve
// blocos simples: é o que o servidor recebe em `blocos` para montar o Word.

export interface TrechoDeTexto {
  t: string;
  b?: boolean;
  bl?: boolean;
}

export type BlocoDoContrato =
  | { k: 'h1' | 'h3' | 'data' | 'p'; runs: TrechoDeTexto[] }
  | { k: 'ass'; itens: [string, string][] };

function trechos(el: Element): TrechoDeTexto[] {
  const r: TrechoDeTexto[] = [];
  const andar = (no: Node, b: boolean, bl: boolean) => {
    no.childNodes.forEach((k) => {
      if (k.nodeType === 3) {
        const t = (k.nodeValue ?? '').replace(/\s+/g, ' ');
        if (t) r.push({ t, b, bl });
      } else if (k.nodeType === 1) {
        const e = k as Element;
        if (e.tagName === 'BR') {
          r.push({ t: ' ', b, bl });
          return;
        }
        andar(e, b || e.tagName === 'B' || e.tagName === 'STRONG', bl || e.classList.contains('blank'));
      }
    });
  };
  andar(el, false, false);
  if (r.length) {
    r[0].t = r[0].t.replace(/^ +/, '');
    r[r.length - 1].t = r[r.length - 1].t.replace(/ +$/, '');
  }
  return r.filter((x) => x.t);
}

export function ctBlocos(root: Element): BlocoDoContrato[] {
  const out: BlocoDoContrato[] = [];
  for (const el of Array.from(root.children)) {
    const tg = el.tagName;
    if (el.classList.contains('ct-ass')) {
      out.push({
        k: 'ass',
        itens: Array.from(el.children).map((d) => {
          const copia = d.cloneNode(true) as Element;
          const sm = copia.querySelector('small');
          const papel = sm ? (sm.textContent ?? '').trim() : '';
          sm?.remove();
          return [(copia.textContent ?? '').trim(), papel] as [string, string];
        }),
      });
      continue;
    }
    const k = tg === 'H1' || tg === 'H2' ? 'h1' : /^H[3-6]$/.test(tg) ? 'h3' : el.classList.contains('ct-data') ? 'data' : 'p';
    out.push({ k, runs: trechos(el) });
  }
  return out.filter((b) => b.k === 'ass' || b.runs.length);
}
