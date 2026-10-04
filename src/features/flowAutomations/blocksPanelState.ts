// O painel Blocos fica aberto ou fechado como a pessoa deixou (sprint 4, A.2).
// É conveniência deste navegador: pode voltar vazio (aba anônima, dados
// limpos) e o acesso ao armazenamento pode até lançar erro (navegador que
// bloqueia). Por isso tudo em try/catch, e o padrão é aberto.

const KEY = 'lmflow:construtor:blocos-aberto';

export function readBlocksOpen(fallback = true): boolean {
  try {
    const value = window.localStorage.getItem(KEY);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // sem armazenamento: fica o padrão
  }
  return fallback;
}

export function saveBlocksOpen(open: boolean): void {
  try {
    window.localStorage.setItem(KEY, open ? '1' : '0');
  } catch {
    // sem armazenamento: só não lembra
  }
}
