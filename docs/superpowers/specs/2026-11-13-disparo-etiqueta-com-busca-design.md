# Disparo: escolher etiqueta com busca (13/11/2026)

## Por quê
No Disparo, passo "Enviar para" → "Por etiqueta", a conta mostra uma parede de pílulas com todas as
etiquetas (Moeda Forte e similares passam de 60). O Tony pediu caixa compacta com busca.

## Abordagens
- **A. Reusar `EscolhaDeEtiqueta` do construtor (escolhida pelo Tony):** busca, "N marcadas" + Limpar,
  Marcadas no alto, Da equipe, Do sistema recolhido, contagem de leads por linha, altura fixa com rolagem.
- B. `EscolhaComBusca` (filtros do Funil): só as marcadas visíveis, resto só digitando. Mais compacta,
  mas não dá pra ver a lista sem digitar. Descartada.

## Desenho
- `EscolhaDeEtiqueta` ganha duas opções, sem mudar os três usos do construtor:
  - `semCriar`: some o "Criar etiqueta" (busca vira "Buscar etiqueta", Enter sem resultado não faz nada,
    sem resultado mostra "Nenhuma etiqueta com esse nome.", lista vazia mostra "Nenhuma etiqueta cadastrada ainda.").
  - `semNome` + `idBusca`: não repete o rótulo "Etiquetas" (o campo da janela já tem) e liga o rótulo
    da janela à busca. "N marcadas · Limpar" continua.
- `PassoQuemRecebe` troca as pílulas por `EscolhaDeEtiqueta modo="varias" semCriar semNome`, ordem por nome.
  Erro de carga continua com Tentar de novo.
- `BulkDispatchModal` pede as etiquetas com contagem (`getLabels({ withCounts: true })`, já usado no construtor).
- Regra do disparo não muda: casa por título, "qualquer uma das marcadas".

## Fora
Criar etiqueta no disparo; backend; a escolha de etiqueta do painel "Escolher leads".
