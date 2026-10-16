// Dinheiro digitado do jeito brasileiro: ponto é milhar, vírgula é centavo.
// O <input type="number"> do navegador recusava "244.630,00" (vazio, e a
// tipologia perdia o preço sem aviso) e lia "244.630" errado. Aqui tudo vira
// o número certo e volta formatado pra caixa.

const milhar = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** O que a pessoa digitou → o texto que a caixa mostra e o número que o formulário guarda. */
export function lerDinheiro(bruto: string): { texto: string; valor: number | null } {
  const limpo = bruto.replace(/[^\d,]/g, '');
  const [inteiroCru, ...resto] = limpo.split(',');
  const temVirgula = resto.length > 0;
  const centavos = resto.join('').slice(0, 2);
  const inteiro = inteiroCru.replace(/^0+(?=\d)/, '');
  if (!inteiro && !centavos) return { texto: '', valor: null };
  const base = inteiro || '0';
  return {
    texto: milhar(base) + (temVirgula ? `,${centavos}` : ''),
    valor: Number(`${base}.${centavos || '0'}`),
  };
}

/** Número salvo → texto da caixa: 244633 → "244.633", 267818.06 → "267.818,06". */
export function textoDoDinheiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  const [inteiro, dec] = valor.toFixed(2).split('.');
  return milhar(inteiro) + (dec === '00' ? '' : `,${dec}`);
}
