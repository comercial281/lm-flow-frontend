import { useCallback, useState } from 'react';

// UM PAINEL POR VEZ no campo de mensagem (Automações · sprint 4, 04/10/2026).
// O painel de books abria por cima do de funil (e o emoji por cima dos dois).
// Abrir um fecha o outro; clicar no botão do que está aberto fecha ele.
// `close(painel)` só fecha se for ESSE o aberto: o "clicou fora" do emoji
// chega antes do clique no botão de outro painel e não pode fechar o novo.

export type ComposerPanel = 'emoji' | 'funnel' | 'book';

export function useComposerPanel() {
  const [open, setOpen] = useState<ComposerPanel | null>(null);
  const toggle = useCallback((panel: ComposerPanel) => setOpen(current => (current === panel ? null : panel)), []);
  const close = useCallback((panel: ComposerPanel) => setOpen(current => (current === panel ? null : current)), []);
  return { open, toggle, close };
}
