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

## Revisão 14/11: contagem certa (decisão do Tony)
A revisão mostrou que `contacts_count` (etiqueta no contato, conta inteira) não é o público do disparo
(este funil, etiqueta no contato OU na conversa, com telefone). Tony: "como o cara vai saber?" → contar igual ao disparo.
- **Backend (PR primeiro):** `GET /api/v1/broadcasts/label_counts?pipeline_id=` → `{ data: { "<título>": N } }`.
  Mesma régua do `from_tags`: leads do funil, com telefone, etiqueta no contato (taggings) ou na conversa
  (`cached_label_list`, título ou id → título), um por contato. Corretor (`broadcasts.own`): só os leads dele.
  Não desconta as travas anti-spam (isso é o "Vai para N"). Permissão `broadcasts.create`, como a prévia.
- **Frontend:** o Disparo volta a `getLabels()` sem contagem e preenche `contacts_count` com a contagem do funil
  (etiqueta sem lead no funil = 0). Falhou a contagem: lista sem número, não "0 leads".
