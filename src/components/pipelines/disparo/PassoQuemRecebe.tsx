import { Loader2, Users } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { plural, telefone } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/types/analytics';
import type { Label as LabelType } from '@/types/settings';
import type {
  AudienceMode,
  AudiencePreviewFull,
  BroadcastChannelKind,
  SenderOption,
} from '@/services/broadcasts/broadcastsService';
import { linhaDeFora } from './automacao';

// PASSO 1 DO DISPARO (16/10/2026): por onde sai (canal + número de saída) e
// quem recebe. O número vem antes do público porque "lead de outro corretor"
// depende dele: a contagem já desconta quem fica de fora e diz por quê.

// Aviso não gira ícone sozinho: este gira durante a contagem.
const IconeGirando = ((props: LucideProps) => (
  <Loader2 {...props} className={cn(props.className, 'animate-spin')} />
)) as unknown as LucideIcon;

const SEM_DISPARO: Record<NonNullable<SenderOption['reason']>, string> = {
  disconnected: '(desconectado)',
  unsupported: '(este tipo de conexão ainda não faz disparo)',
};

function rotuloDoNumero(o: SenderOption): string {
  const nome = o.phone ? `${o.name} · ${telefone(o.phone)}` : o.name;
  if (o.sendable) return nome;
  return `${nome} ${SEM_DISPARO[o.reason ?? 'disconnected']}`;
}

interface Props {
  channelKind: BroadcastChannelKind;
  aoEscolherCanal: (canal: BroadcastChannelKind) => void;
  /** Tem número oficial conectado (o "WhatsApp oficial" só fica clicável assim). */
  temOficial: boolean;
  /** Os números oficiais ainda estão chegando (não é "sem número oficial"). */
  carregandoOficial: boolean;
  erroCanais: boolean;
  aoTentarCanais: () => void;

  /** Null = carregando. */
  numeros: SenderOption[] | null;
  erroNumeros: boolean;
  aoTentarNumeros: () => void;
  senderInboxId: string;
  aoEscolherNumero: (inboxId: string) => void;
  /** Nome do número que a automação do passo 2 impõe: o campo fica travado nele. */
  numeroTravado?: string | null;

  /** Só na página Disparos: escolher o funil de onde sai o público. */
  funis?: { id: string; name: string }[];
  funilId?: string;
  aoEscolherFunil?: (id: string) => void;

  audienceMode: AudienceMode;
  aoEscolherPublico: (modo: AudienceMode) => void;
  stages: PipelineStage[];
  stageId: string;
  aoEscolherEtapa: (id: string) => void;
  etiquetas: LabelType[];
  erroEtiquetas: boolean;
  aoTentarEtiquetas: () => void;
  etiquetasMarcadas: string[];
  aoMarcarEtiqueta: (titulo: string) => void;

  previa: AudiencePreviewFull | null;
  contando: boolean;
  erroPrevia: boolean;
}

export default function PassoQuemRecebe(p: Props) {
  const cloudMode = p.channelKind === 'whatsapp_cloud';
  const deFora = p.previa ? linhaDeFora(p.previa.excluded) : null;

  return (
    <div className="grid gap-5">
      <GrupoDaJanela titulo="Por onde sai">
        <BotoesDeEscolha<BroadcastChannelKind>
          rotulo="Por onde sai"
          semNome
          valor={p.channelKind}
          aoEscolher={p.aoEscolherCanal}
          opcoes={[
            { valor: 'evolution', rotulo: 'Campanha direta' },
            {
              valor: 'whatsapp_cloud',
              rotulo: 'WhatsApp oficial (modelo aprovado)',
              desabilitada: !p.temOficial,
              motivo: p.erroCanais
                ? undefined
                : p.carregandoOficial
                  ? 'Carregando números oficiais…'
                  : 'Conecte um número oficial em Integrações',
            },
          ]}
        />
        {p.erroCanais ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={p.aoTentarCanais} className="p-3" />
        ) : p.carregandoOficial ? (
          <p className="text-xs text-muted-foreground">Carregando números oficiais…</p>
        ) : !p.temOficial ? (
          <p className="text-xs text-muted-foreground">Conecte um número oficial em Integrações</p>
        ) : null}

        {!cloudMode && (
          <CampoDaJanela
            rotulo="Número de saída"
            htmlFor="disparo-numero-saida"
            ajuda={
              p.numeroTravado
                ? 'Pra escolher outro número, troque a automação no passo 2.'
                : 'Lead de outro corretor fica de fora. O número da imobiliária manda pra todos.'
            }
          >
            {p.numeroTravado ? (
              <Seletor id="disparo-numero-saida" className="w-full" value="travado" disabled onChange={() => {}}>
                <option value="travado">Sai pelo número da automação: {p.numeroTravado}</option>
              </Seletor>
            ) : p.erroNumeros ? (
              <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={p.aoTentarNumeros} className="p-3" />
            ) : p.numeros === null ? (
              <Carregando variante="texto" linhas={1} rotulo="Carregando os números…" />
            ) : p.numeros.length === 0 ? (
              <EmptyState
                tamanho="compacto"
                title="Nenhum número de WhatsApp conectado."
                description="Conecte um número em Integrações pra disparar."
                className="p-3"
              />
            ) : (
              <Seletor
                id="disparo-numero-saida"
                className="w-full"
                value={p.senderInboxId}
                onChange={e => p.aoEscolherNumero(e.target.value)}
              >
                {!p.senderInboxId && <option value="">Escolher número</option>}
                {p.numeros.map(o => (
                  <option key={o.inbox_id} value={o.inbox_id} disabled={!o.sendable}>
                    {rotuloDoNumero(o)}
                  </option>
                ))}
              </Seletor>
            )}
          </CampoDaJanela>
        )}
      </GrupoDaJanela>

      <GrupoDaJanela titulo="Quem recebe">
        {p.funis && (
          <CampoDaJanela rotulo="Funil" htmlFor="disparo-funil">
            <Seletor
              id="disparo-funil"
              className="w-full"
              value={p.funilId ?? ''}
              onChange={e => p.aoEscolherFunil?.(e.target.value)}
            >
              {p.funis.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Seletor>
          </CampoDaJanela>
        )}
        <CampoDaJanela rotulo="Enviar para" htmlFor="disparo-quem-recebe">
          <Select value={p.audienceMode} onValueChange={v => p.aoEscolherPublico(v as AudienceMode)}>
            <SelectTrigger id="disparo-quem-recebe" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pipeline">Todos os leads do funil</SelectItem>
              <SelectItem value="stage">Uma etapa específica</SelectItem>
              <SelectItem value="tag">Por etiqueta</SelectItem>
            </SelectContent>
          </Select>
        </CampoDaJanela>

        {p.audienceMode === 'tag' && (
          <CampoDaJanela rotulo="Etiquetas" ajuda="Recebe quem tem qualquer uma das etiquetas marcadas.">
            {p.erroEtiquetas ? (
              <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={p.aoTentarEtiquetas} className="p-3" />
            ) : p.etiquetas.length === 0 ? (
              <EmptyState tamanho="compacto" title="Nenhuma etiqueta cadastrada ainda." className="p-3" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.etiquetas.map(l => {
                  const active = p.etiquetasMarcadas.includes(l.title);
                  const color = l.color || '#7c3aed';
                  return (
                    <button
                      key={l.title}
                      type="button"
                      aria-pressed={active}
                      onClick={() => p.aoMarcarEtiqueta(l.title)}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                        active ? 'text-white' : 'text-foreground hover:bg-muted'
                      }`}
                      style={active ? { backgroundColor: color, borderColor: color } : { borderColor: `${color}66` }}
                    >
                      {l.title}
                    </button>
                  );
                })}
              </div>
            )}
          </CampoDaJanela>
        )}

        {p.audienceMode === 'stage' && (
          <CampoDaJanela rotulo="Etapa" htmlFor="disparo-etapa">
            <Select value={p.stageId} onValueChange={p.aoEscolherEtapa}>
              <SelectTrigger id="disparo-etapa" className="w-full">
                <SelectValue placeholder="Escolher etapa" />
              </SelectTrigger>
              <SelectContent>
                {p.stages.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoDaJanela>
        )}
      </GrupoDaJanela>

      <Aviso tom="info" icone={p.contando ? IconeGirando : Users}>
        {p.contando ? (
          <>Contando destinatários...</>
        ) : p.previa ? (
          <>
            <strong>{plural(p.previa.count, 'lead', 'leads')}</strong> {p.previa.count === 1 ? 'vai receber' : 'vão receber'}.
            {deFora && <span className="mt-1 block">{deFora}</span>}
          </>
        ) : p.erroPrevia ? (
          <>Não deu pra contar os destinatários agora. Troque a escolha pra tentar de novo.</>
        ) : p.audienceMode === 'tag' ? (
          <>Marque ao menos uma etiqueta pra contar os destinatários.</>
        ) : (
          <>Escolha a etapa pra contar os destinatários.</>
        )}
      </Aviso>
    </div>
  );
}
