// O tradutor do Google reescreve os nós de texto que o React criou
// (facebook/react#11538). Na próxima navegação/filtro o React tenta tirar ou
// inserir um nó que já não é filho de quem ele acha, o navegador estoura
// "Failed to execute 'removeChild'/'insertBefore'" e o site cai na tela de erro.
// A proteção conhecida: se o nó não é mais filho deste pai, ignora em vez de
// estourar. Instalada uma vez, só no site público com o botão de idiomas ligado.

let instalada = false;
let avisou = false;

function avisar() {
  if (avisou) return;
  avisou = true;
  console.warn('[Tradução] o tradutor mexeu na página; operação de DOM ignorada para não quebrar o site.');
}

export function protegerDomDoTradutor(): void {
  if (instalada || typeof Node === 'undefined') return;
  instalada = true;

  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) { avisar(); return child; }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) { avisar(); return node; }
    return insertBefore.call(this, node, ref) as T;
  };
}
