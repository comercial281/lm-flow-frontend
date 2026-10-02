// Lê os filhos de um <select> (<option>/<optgroup>) do jeito que o navegador
// leria, para o Seletor desenhar a lista do produto com o MESMO conteúdo.
//
// Por que existe: o Select do design system (Radix) não aceita opção de valor
// vazio e só trabalha com texto. As telas usam "" para "Todos"/"Tipo de
// negócio" e às vezes número. A tradução fica aqui, num lugar só, para a tela
// continuar recebendo exatamente o que o <select> nativo entregaria.
import {
  Children, Fragment, isValidElement,
  type ChangeEvent, type CSSProperties, type ReactNode,
} from 'react';

// Valor reservado que representa "" dentro do Radix. Ninguém grava isto.
export const VALOR_VAZIO = '__seletor_vazio__';

export type OpcaoDoSeletor = {
  valor: string;
  rotulo: ReactNode;
  desligada: boolean;
  estilo?: CSSProperties;
};

export type ItemDoSeletor =
  | ({ tipo: 'opcao' } & OpcaoDoSeletor)
  | { tipo: 'grupo'; rotulo: ReactNode; opcoes: OpcaoDoSeletor[] };

type PropsDeOpcao = {
  value?: unknown;
  children?: ReactNode;
  disabled?: boolean;
  hidden?: boolean;
  style?: CSSProperties;
};

const comoTexto = (v: unknown) => (v === undefined || v === null ? '' : String(v));

// Sem `value`, o navegador usa o texto da opção como valor.
const textoDe = (nos: ReactNode) =>
  Children.toArray(nos)
    .map(n => (typeof n === 'string' || typeof n === 'number' ? String(n) : ''))
    .join('');

function lerOpcao(props: PropsDeOpcao): OpcaoDoSeletor | null {
  if (props.hidden) return null;
  return {
    valor: props.value !== undefined ? comoTexto(props.value) : textoDe(props.children),
    rotulo: props.children,
    desligada: Boolean(props.disabled),
    estilo: props.style,
  };
}

export function lerItens(children: ReactNode): ItemDoSeletor[] {
  const itens: ItemDoSeletor[] = [];
  const visitar = (nos: ReactNode) => {
    // Children.forEach já achata array e pula false/null; Fragment não.
    Children.forEach(nos, no => {
      if (!isValidElement(no)) return;
      const props = no.props as PropsDeOpcao & { label?: ReactNode };
      if (no.type === Fragment) return visitar(props.children);
      if (no.type === 'option') {
        const opcao = lerOpcao(props);
        if (opcao) itens.push({ tipo: 'opcao', ...opcao });
        return;
      }
      if (no.type === 'optgroup') {
        const opcoes = lerItens(props.children).flatMap(i =>
          i.tipo === 'opcao' ? [{ valor: i.valor, rotulo: i.rotulo, desligada: i.desligada, estilo: i.estilo }] : i.opcoes,
        );
        if (opcoes.length) itens.push({ tipo: 'grupo', rotulo: props.label, opcoes });
      }
    });
  };
  visitar(children);
  return itens;
}

const todasAsOpcoes = (itens: ItemDoSeletor[]): OpcaoDoSeletor[] =>
  itens.flatMap(i => (i.tipo === 'opcao' ? [i] : i.opcoes));

export const paraRadix = (valor: string) => (valor === '' ? VALOR_VAZIO : valor);
export const deRadix = (valor: string) => (valor === VALOR_VAZIO ? '' : valor);

// O que a caixa mostra, já no formato do Radix. Valor que não casa com nenhuma
// opção mostra a primeira, que é o que o <select> nativo faz.
export function valorExibido(valor: unknown, itens: ItemDoSeletor[]): string {
  const opcoes = todasAsOpcoes(itens);
  if (!opcoes.length) return '';
  const procurado = comoTexto(valor);
  const achada = opcoes.find(o => o.valor === procurado) ?? opcoes[0];
  return paraRadix(achada.valor);
}

// O onChange das telas lê e.target.value (às vezes e.currentTarget.value).
export function eventoDeMudanca(valor: string, name?: string): ChangeEvent<HTMLSelectElement> {
  const alvo = { value: valor, name: name ?? '' };
  return {
    target: alvo,
    currentTarget: alvo,
    type: 'change',
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as ChangeEvent<HTMLSelectElement>;
}
