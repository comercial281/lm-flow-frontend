import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import MessageSequenceEditor, { type SequenceDraftItem } from '@/components/messaging/MessageSequenceEditor';
import {
  broadcastsService,
  type AutomationOption,
  type CloudChannelOption,
  type CloudTemplateOption,
  type FlowSummary,
} from '@/services/broadcasts/broadcastsService';
import type { TemplateVariable } from '@/types/messageFunnels';
import { dinheiro, telefone } from '@/lib/formato';
import FunilDoDisparo from './FunilDoDisparo';
import AutomacaoDoDisparo from './AutomacaoDoDisparo';
import ResumoDaAutomacao from './ResumoDaAutomacao';

// PASSO 2 DO DISPARO (16/10/2026): o que mandar. Na Campanha direta, uma
// sequência de mensagens (o editor de sempre) ou um funil pronto, em que o
// lead entra. No WhatsApp oficial, o modelo aprovado de hoje.
// Desde 23/10/2026, a terceira opção "Automação" (só na Campanha direta): o lead
// entra numa automação, com o resumo "Quem recebe" logo abaixo dela.

export type ModoDoEnvio = 'message' | 'flow' | 'automation';

interface Props {
  cloudMode: boolean;

  sendMode: ModoDoEnvio;
  aoEscolherModo: (modo: ModoDoEnvio) => void;
  items: SequenceDraftItem[];
  aoMudarItens: (items: SequenceDraftItem[]) => void;
  variables: TemplateVariable[];
  flowId: string;
  aoEscolherFunil: (id: string, nome: string) => void;

  automacaoId: string;
  aoEscolherAutomacao: (automacao: AutomationOption | null) => void;
  /** Resumo da audiência diante da automação (null = contando ou falhou). */
  resumoDaAutomacao: FlowSummary | null;
  contando: boolean;
  erroDaContagem: boolean;
  incluirQuemPassou: boolean;
  aoMudarIncluirQuemPassou: (v: boolean) => void;
  recomecarRodando: boolean;
  aoMudarRecomecarRodando: (v: boolean) => void;

  cloudOptions: CloudChannelOption[];
  erroCanais: boolean;
  aoTentarCanais: () => void;
  cloudInbox: CloudChannelOption | undefined;
  aoEscolherNumeroOficial: (inboxId: string) => void;
  cloudTemplateName: string;
  cloudTemplate: CloudTemplateOption | undefined;
  aoEscolherModelo: (nome: string) => void;
  cloudVars: Record<string, string>;
  aoMudarVariavel: (variavel: string, valor: string) => void;
  /** Teto de gasto (R$) do disparo oficial, como o usuário digitou. */
  tetoDeGasto: string;
  aoMudarTeto: (valor: string) => void;
  /** Frase de erro do teto (texto que não é valor em reais); vazio = ok. */
  erroDoTeto?: string;
  /** Custo estimado do disparo oficial (null = ainda sem como estimar). */
  custo: { categoria: string; tarifa: number; total: number } | null;
  quantidade: number;
}

export default function PassoMensagem(p: Props) {
  if (p.cloudMode) return <ModeloOficial {...p} />;

  return (
    <div className="grid gap-5">
      <GrupoDaJanela titulo="O que mandar">
        <BotoesDeEscolha<ModoDoEnvio>
          rotulo="O que mandar"
          semNome
          valor={p.sendMode}
          aoEscolher={p.aoEscolherModo}
          opcoes={[
            { valor: 'message', rotulo: 'Mensagem' },
            { valor: 'flow', rotulo: 'Funil pronto' },
            { valor: 'automation', rotulo: 'Automação' },
          ]}
        />
      </GrupoDaJanela>

      {p.sendMode === 'automation' ? (
        // Sem GrupoDaJanela "Automação": o campo já tem esse rótulo. O resumo
        // "Quem recebe" mora no mesmo bloco, logo abaixo da automação escolhida.
        <div className="grid gap-3">
          <AutomacaoDoDisparo automacaoId={p.automacaoId} aoEscolher={p.aoEscolherAutomacao} />
          {p.automacaoId && (
            <ResumoDaAutomacao
              resumo={p.resumoDaAutomacao}
              contando={p.contando}
              erro={p.erroDaContagem}
              incluirQuemPassou={p.incluirQuemPassou}
              aoMudarIncluirQuemPassou={p.aoMudarIncluirQuemPassou}
              recomecarRodando={p.recomecarRodando}
              aoMudarRecomecarRodando={p.aoMudarRecomecarRodando}
            />
          )}
        </div>
      ) : p.sendMode === 'message' ? (
        <GrupoDaJanela titulo="Sequência de mensagens">
          <MessageSequenceEditor
            items={p.items}
            onChange={p.aoMudarItens}
            variables={p.variables}
            uploadMedia={broadcastsService.uploadMedia.bind(broadcastsService)}
            allowTextVariations
            excludeKinds={['contact', 'sticker']}
          />
          <p className="text-xs text-muted-foreground">
            Use as variáveis pra personalizar (ex.: {'{{nome}}'}); a mídia é anexada na hora.
          </p>
        </GrupoDaJanela>
      ) : (
        <GrupoDaJanela titulo="Funil pronto">
          <FunilDoDisparo flowId={p.flowId} aoEscolher={p.aoEscolherFunil} />
        </GrupoDaJanela>
      )}
    </div>
  );
}

function ModeloOficial(p: Props) {
  const template = p.cloudTemplate;
  return (
    <div className="grid gap-5">
      <GrupoDaJanela titulo="Modelo aprovado">
        {p.erroCanais ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={p.aoTentarCanais} className="p-4" />
        ) : p.cloudOptions.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            title="Nenhum número oficial conectado."
            description="Conecte um número oficial em Integrações e aprove um modelo pra disparar por aqui."
            className="p-4"
          />
        ) : (
          <>
            {p.cloudOptions.length > 1 && (
              <CampoDaJanela rotulo="Número do canal oficial" htmlFor="disparo-numero-oficial">
                <Select value={p.cloudInbox?.inbox_id ?? ''} onValueChange={p.aoEscolherNumeroOficial}>
                  <SelectTrigger id="disparo-numero-oficial" className="w-full">
                    <SelectValue placeholder="Escolher número" />
                  </SelectTrigger>
                  <SelectContent>
                    {p.cloudOptions.map(o => (
                      <SelectItem key={o.inbox_id} value={o.inbox_id}>
                        {o.name} · {telefone(o.phone_number)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CampoDaJanela>
            )}

            <CampoDaJanela rotulo="Modelo" htmlFor="disparo-template">
              {(p.cloudInbox?.templates.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Esse número não tem modelo ainda. Crie e aprove um modelo de mensagem na Meta primeiro.
                </p>
              ) : (
                <Select value={p.cloudTemplateName} onValueChange={p.aoEscolherModelo}>
                  <SelectTrigger id="disparo-template" className="w-full">
                    <SelectValue placeholder="Escolher modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {p.cloudInbox?.templates.map(t => (
                      <SelectItem key={`${t.name}_${t.language}`} value={t.name} disabled={!t.approved}>
                        {t.name} · {t.language}
                        {!t.approved && ` (${(t.status || 'pendente').toLowerCase()})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CampoDaJanela>

            {template && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{template.content}</div>
            )}

            {template && template.variables.length > 0 && (
              <CampoDaJanela rotulo="Variáveis do modelo" ajuda={<>Use {'{{nome}}'} pra puxar o nome do lead.</>}>
                <div className="grid gap-2">
                  {template.variables.map((v, i) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">{`{{${i + 1}}}`}</span>
                      <Input
                        value={p.cloudVars[v] ?? ''}
                        onChange={e => p.aoMudarVariavel(v, e.target.value)}
                        placeholder="{{nome}} ou texto fixo"
                        aria-label={`Variável ${i + 1} do modelo`}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </CampoDaJanela>
            )}

            <CampoDaJanela
              rotulo="Teto de gasto (R$)"
              htmlFor="disparo-teto"
              ajuda="Opcional. O disparo para quando chegar nesse valor."
              erro={p.erroDoTeto || undefined}
            >
              <Input
                id="disparo-teto"
                type="text"
                inputMode="decimal"
                value={p.tetoDeGasto}
                onChange={e => p.aoMudarTeto(e.target.value)}
                className="h-9"
                placeholder="opcional"
                aria-invalid={p.erroDoTeto ? true : undefined}
              />
            </CampoDaJanela>

            {p.custo && (
              <p className="text-xs text-muted-foreground">
                Custo estimado: <strong className="text-foreground">{dinheiro(p.custo.total)}</strong>{' '}
                ({p.quantidade} msg × {dinheiro(p.custo.tarifa)}, categoria {p.custo.categoria}). Estimativa: o custo real vem da Meta.
              </p>
            )}

            <Aviso tom="info" compacto>
              Fora da janela de 24h, a Meta só entrega modelo aprovado. As variáveis são preenchidas por lead.
            </Aviso>
          </>
        )}
      </GrupoDaJanela>
    </div>
  );
}
