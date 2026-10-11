import { useState } from 'react';

// Aba de estado (`Abas` sem `para`) dentro de janela: volta pra `inicial` toda
// vez que a janela abre. É o que o `Tabs` do pacote base fazia sozinho (o
// conteúdo da janela desmonta ao fechar e o `defaultValue` valia de novo),
// enquanto o componente da janela continua montado com a janela fechada.
// Ajuste durante a renderização (e não em efeito) pra não piscar a aba antiga.
export function useAbaDaJanela<T extends string>(aberta: boolean, inicial: T) {
  const [aba, setAba] = useState<T>(inicial);
  const [abertaAntes, setAbertaAntes] = useState(aberta);
  if (aberta !== abertaAntes) {
    setAbertaAntes(aberta);
    if (aberta) setAba(inicial);
  }
  return [aba, setAba] as const;
}
