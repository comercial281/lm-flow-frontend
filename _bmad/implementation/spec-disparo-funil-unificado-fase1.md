---
title: 'Disparo em Massa unificado com o modal de Funil de Mensagens — Fase 1'
type: 'feature'
created: '2026-06-23'
status: 'draft'
context:
  - '{project-root}/src/components/pipelines/BulkDispatchModal.tsx'
  - '{project-root}/src/components/messageFunnels/MessageFunnelEditor.tsx'
  - '{project-root}/src/types/messageFunnels.ts'
  - 'lm-flow-backend/app/controllers/api/v1/broadcasts_controller.rb'
  - 'lm-flow-backend/app/services/broadcasts/send_one.rb'
  - 'lm-flow-backend/app/jobs/broadcasts/process_campaigns_job.rb'
  - 'lm-flow-backend/app/services/lead_automation/executor.rb'
---

<frozen-after-approval reason="intent humano — não alterar sem renegociar com o Giovani">

## Intent

**Problema:** Existem DOIS editores de mensagem de WhatsApp divergentes no LM Flow. O `MessageFunnelEditor` (rico: sequência multi-item texto/áudio/imagem/vídeo/documento, gravar áudio na hora + upload, variáveis built-in + custom por tenant, chips de inserir) e o `BulkDispatchModal` (pobre: "variações" A/B até 4, só `{{nome}}`, templates só no localStorage, sem gravar áudio). O Giovani quer UM modal único de funil em todo lugar que dispara WhatsApp, sem inventar tela por contexto.

**Approach (Fase 1):** Extrair o núcleo de "itens em sequência" do `MessageFunnelEditor` num componente reutilizável `MessageSequenceEditor` e usá-lo DENTRO do `BulkDispatchModal` no lugar do passo "Mensagem" (variações). O disparo passa a enviar uma SEQUÊNCIA multi-item por destinatário, com TODAS as variáveis do lead resolvidas no servidor. Audiência, cadência entre destinatários, teste e acompanhamento de campanha ficam intactos. Backend: `BroadcastCampaign` ganha snapshot `funnel_items` (jsonb); novo `Broadcasts::SendSequence` itera os itens (delay interno por item) reusando os endpoints Evolution do `SendOne`; resolver de variáveis vira serviço compartilhado.

**Fora de escopo (Fases 2 e 3):** delay-como-item-adicionável, nome-do-envio→grupo LOG, destino pós-envio (mover pipeline/etapa + aplicar/criar tag + encadear automação), templates server-side (biblioteca global + por cliente), e propagar o mesmo modal pra ação "Disparar funil" / sequência agendada / follow-up.

## Boundaries & Constraints

**Always:**
- O editor de sequência é UM componente (`MessageSequenceEditor`) consumido pelo `MessageFunnelEditor` E pelo `BulkDispatchModal`. Comportamento idêntico nos dois.
- Disparo envia SEQUÊNCIA (N itens em ordem, com delay por item) por destinatário; cadência aleatória entre destinatários (`min/max_interval`, lotes) continua valendo.
- Variáveis no disparo = as MESMAS do funil (built-in + custom do tenant), resolvidas no servidor por destinatário usando o contato/conversa de cada item.
- Snapshot: a campanha guarda os itens no momento do disparo (`funnel_items` na campanha). Editar funil-fonte depois NÃO altera campanha em andamento.
- Coluna nova (`funnel_items` em `broadcast_campaigns`) entra com fallback `add_column` no boot — `db:migrate` está morto no LM Flow. Ver [[feedback_lm_flow_coluna_nova_fallback_boot]].
- Mídia no disparo precisa de URL pública (Evolution baixa por URL) — o editor sobe o arquivo na hora via `broadcastsService.uploadMedia` e guarda `media_url`. O `MessageSequenceEditor` recebe um adapter `uploadMedia(file) => Promise<{url}>` injetado.
- Gravar áudio no navegador (MediaRecorder) + subir gravado: já existe no `MessageFunnelEditor`; preservar no componente extraído.
- Sem emoji na UI. Verificar com `npm run build` (tsc -b && vite build) — ver [[feedback_lm_flow_verify_with_npm_build]].

**Ask First:**
- Aposentar a "variação A/B (até 4 versões)": a Fase 1 troca variação por sequência. Default: trocar por sequência agora.

**Never:**
- Quebrar campanhas antigas: `BroadcastCampaign#variations` (legado) continua sendo enviado via `SendOne` quando `funnel_items` estiver vazio.
- Resolver variáveis no front. Resolução é server-side no envio.
- `--no-verify`, inventar IDs/credenciais, mock de DB.
- Reescrever o motor de cadência/lotes/horário comercial do `ProcessCampaignsJob` — só trocar "envio de 1 variação" por "envio de 1 sequência".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Abrir Disparo, passo Mensagem | wizard etapa 2 | Renderiza `MessageSequenceEditor` no lugar das variações | — |
| Inserir variável custom | clicar chip `{{empreendimento_atual}}` | Token inserido no cursor do item ativo | fallback só built-in se endpoint cair |
| Sequência 3 itens p/ 20 leads | campanha criada | Cada lead recebe os 3 itens em ordem, delay por item; cadência entre leads respeitada | item falho marca `failed` e segue |
| Variável por destinatário | `Oi {{nome}}, {{empreendimento_atual}}` | Cada lead com SEU nome + SEU custom resolvido server-side | token sem valor vira vazio |
| Mídia anexada | upload imagem | Sobe via `/broadcasts/upload_media` → `media_url`; Evolution envia | >16MB rejeita; falha mantém editável |
| Teste | número + sequência | Manda a sequência inteira só pro teste | erro Evolution vira toast |
| Campanha legada | retomar antiga | Continua via `variations`/`SendOne` | sem regressão |
| Pause/cancel no meio | status muda | Re-check entre destinatários; atual termina, próximos não saem | — |

</frozen-after-approval>

## Code Map

**Frontend (`lm-flow-frontend`):**
- `src/components/messaging/MessageSequenceEditor.tsx` — **NOVO**. Extrair de `MessageFunnelEditor.tsx`: `DraftItem`, `ItemEditor`, `AddItemButtons`, `VariableChips`. Props: `items`, `onChange`, `variables`, `uploadMedia`.
- `src/components/messageFunnels/MessageFunnelEditor.tsx` — **EDITAR**. Consome `MessageSequenceEditor`; mantém nome/descrição/ativo + save em `/message_funnels`.
- `src/components/pipelines/BulkDispatchModal.tsx` — **EDITAR**. Passo "messages" usa `MessageSequenceEditor` + `uploadMedia=broadcastsService.uploadMedia` + variáveis via `tenantTemplateVariablesService.list()`. `handleCreate` envia `funnel_items`. Remover "Modelos" localStorage (TODO Fase 2).
- `src/services/broadcasts/broadcastsService.ts` — **EDITAR**. `create`/`testSend` aceitam `funnel_items: SequenceItem[]`.
- `src/types/messageFunnels.ts` — reusar `FunnelItemKind`/shape de item.

**Backend (`lm-flow-backend`):**
- boot fallback (`lm_flow:create_admin`/`auto_migrate_on_boot`): `add_column :broadcast_campaigns, :funnel_items, :jsonb, default: [], null: false`. Ver [[reference_lm_flow_visits_and_automigrate]].
- `app/models/broadcast_campaign.rb` — `funnel_items` accessor + `funnel_mode?`.
- `app/services/broadcasts/variable_interpolator.rb` — **NOVO**. Extrair interpolação rica do `executor.rb#interpolate` (~662-690): `new(contact:, conversation: nil).call(text)`. built-in + custom `TenantTemplateVariable` por `value_source`. `executor.rb`/`send_one.rb` usam (DRY).
- `app/services/broadcasts/send_sequence.rb` — **NOVO**. Itera itens, interpola por destinatário, `sleep(delay.clamp(0,600))`, reusa build_url/build_body do `SendOne`.
- `app/services/broadcasts/send_one.rb` — **EDITAR**. Usa `VariableInterpolator`; expõe build_url/build_body.
- `app/jobs/broadcasts/process_campaigns_job.rb` — **EDITAR**. funnel_mode→`SendSequence`; legado→`SendOne`. Cadência inalterada.
- `app/controllers/api/v1/broadcasts_controller.rb` — **EDITAR**. `create`/`test_send` aceitam `funnel_items`; snapshot persistido.

**Fase 2/3 (registrar):** `name`→log, `post_send_actions` (pipeline/tag/encadear), `broadcast_message_templates` global+tenant, plugar editor em `send_message_funnel`/scheduled_actions/followup.

## Tasks & Acceptance

**Execution (ordem por dependência):**
- [ ] BE: fallback boot `funnel_items` + `BroadcastCampaign#funnel_items`/`funnel_mode?`.
- [ ] BE: `Broadcasts::VariableInterpolator` extraído; `send_one.rb`/`executor.rb` usam.
- [ ] BE: `Broadcasts::SendSequence`.
- [ ] BE: `ProcessCampaignsJob` roteia funnel_mode/legado.
- [ ] BE: controller `create`/`test_send` aceitam `funnel_items`.
- [ ] FE: extrair `MessageSequenceEditor`; `MessageFunnelEditor` consome.
- [ ] FE: `BulkDispatchModal` usa o editor + manda `funnel_items`.
- [ ] FE: `broadcastsService` + tipos.

**Acceptance Criteria:**
- Given usuário no Disparo, when chega no passo Mensagem, then vê o MESMO editor de sequência do funil (não as "versões A/B").
- Given sequência 2+ itens com `{{nome}}` e custom, when dispara p/ vários leads, then cada lead recebe em ordem com SUAS variáveis + delay por item.
- Given item imagem/áudio, when anexo/grava, then sobe pra URL pública e o lead recebe a mídia.
- Given campanha legada sem `funnel_items`, when retomada, then envia pelas `variations` sem erro.
- Given `npm run build`, then tsc -b && vite build passam 0 erro.
- Given editor extraído, when abro Configurações → Funis, then funciona como antes (sem regressão).

## Design Notes

- **Snapshot na campanha (não `message_funnel_id`):** disparo é pontual; texto/mídia/ordem congelados no envio.
- **Extrair `VariableInterpolator`:** evita o 3º `interpolate` divergente (executor, send_step, send_one).
- **Delay por item na Fase 1 = campo embutido** (como já é). Vira item-adicionável na Fase 2.
- **Tradeoff variação A/B:** dropada na Fase 1; volta como "alternativas por item" na Fase 2 se preciso.

## Verification

- `cd /c/Users/giova/dev/lm-flow-frontend && npm run build` — 0 erro.
- `cd /c/Users/giova/dev/lm-flow-backend && bundle exec rubocop app/services/broadcasts app/jobs/broadcasts` — sem ofensa nova.
- Smoke: campanha com `funnel_items` de 2 itens + envio de teste pro número do Giovani (autorizar antes de lead real).
- Provar deploy via API (Railway + Vercel) — ver [[feedback_verificar_deploy_eu_mesmo_via_api]].
