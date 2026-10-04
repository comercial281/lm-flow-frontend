// Ícone da aba do site público (Meu site › Aparência › Ícone da aba).
//
// O index.html é o do LM Flow e traz vários <link rel="icon"> (um por tamanho).
// O navegador escolhe entre eles pelo tamanho, então trocar só um deixaria o
// ícone do LM Flow vencer em parte das telas: TODOS os `rel~="icon"` passam a
// apontar pro ícone do site, sem `type`/`sizes` (o arquivo enviado pode ser PNG,
// SVG ou outro). Ao sair da página, cada um volta como estava — o mesmo
// navegador pode abrir o CRM em seguida. Sem nenhum link no <head>, cria um e
// tira ao sair.
//
// Endereço que não é http(s) é ignorado: o campo vem do servidor, e um
// `javascript:` ou `data:` não tem por que virar ícone.
import { useEffect } from 'react';

const HTTP = /^https?:\/\//i;
const ATRIBUTOS = ['href', 'type', 'sizes'] as const;

export function useIconeDaAba(url: string | null | undefined): void {
  const valida = typeof url === 'string' && HTTP.test(url.trim()) ? url.trim() : null;

  useEffect(() => {
    if (!valida) return;
    const existentes = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

    if (existentes.length === 0) {
      const novo = document.createElement('link');
      novo.rel = 'icon';
      novo.href = valida;
      document.head.appendChild(novo);
      return () => { novo.remove(); };
    }

    const antes = existentes.map(link => ATRIBUTOS.map(a => link.getAttribute(a)));
    for (const link of existentes) {
      link.removeAttribute('type');
      link.removeAttribute('sizes');
      link.setAttribute('href', valida);
    }
    return () => {
      existentes.forEach((link, i) => {
        ATRIBUTOS.forEach((a, k) => {
          const valor = antes[i][k];
          if (valor === null) link.removeAttribute(a);
          else link.setAttribute(a, valor);
        });
      });
    };
  }, [valida]);
}
