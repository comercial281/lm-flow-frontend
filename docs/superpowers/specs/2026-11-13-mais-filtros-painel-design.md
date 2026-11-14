# Mais filtros do Moderno em painel flutuante (13/11/2026)

## Por quê
Na capa do Moderno, abrir "Mais filtros" faz a capa crescer e empurra a página. O Tony quer que a segunda linha desça como um cartão por cima da seção de baixo, com animação e sombra.

## O que muda (decidido)
- A linha extra vira um painel absoluto logo abaixo da busca, na mesma largura: branco (`--m-surface`), cantos arredondados, sombra mais funda que a da busca. A capa não muda de altura.
- Animação: desce ~8px e aparece em ~200ms; em "Menos filtros" sobe e some do mesmo jeito (fica montado até a saída terminar). Com `prefers-reduced-motion`, sem animação.
- **Clique fora NÃO fecha** (decisão do Tony). Esc fecha (call do Claude, acessibilidade).
- Vale nas duas capas (foto e dividida) e no celular. A dividida ganha a camada (`relative z-10`) pra ficar por cima da seção seguinte.

## Não muda
- Quais campos vão pro "Mais filtros" (`useBuscaDaCapa`), o Clássico e a página de Imóveis.

## Abordagens
1. **Painel absoluto com transição CSS (escolhida):** só tela, a capa com foto já deixa passar por cima (z-10, sem overflow-hidden).
2. Expandir empurrando (como hoje) com animação de altura: não atende o pedido (não sobrepõe).
3. Portal/popover flutuante: desnecessário, o absoluto basta.
