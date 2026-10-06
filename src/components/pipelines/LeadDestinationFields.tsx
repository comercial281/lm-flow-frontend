import { useEffect, useMemo, useState } from 'react';
import { Seletor } from '@/components/base/Seletor';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import CampoQuemAssume from '@/components/roleta/CampoQuemAssume';
import type { DestinationOpt, LeadDestinationOptions } from './useLeadDestinationOptions';

/** Um destino do lead. String vazia = não escolhido (volta ao padrão). */
export interface LeadDestinationValue {
  pipeline_id: string;
  stage_id: string;
  roleta_config_id: string;
  default_assignee_id: string;
  label_id: string;
}

export const EMPTY_DESTINATION: LeadDestinationValue = {
  pipeline_id: '', stage_id: '', roleta_config_id: '', default_assignee_id: '', label_id: '',
};

/** Alguma leitura deu certo? Se nenhuma, quem chama esconde a seção inteira. */
export function hasAnyDestinationOption(o: LeadDestinationOptions, showLabel = false): boolean {
  return o.pipelines !== null || o.roletas !== null || o.users !== null || (showLabel && o.labels !== null);
}

interface Props {
  value: LeadDestinationValue;
  onChange: (patch: Partial<LeadDestinationValue>) => void;
  options: LeadDestinationOptions;
  /** Seletor de etiqueta (site). O portal não tem etiqueta própria. */
  showLabel?: boolean;
}

/**
 * Funil, coluna, quem assume (corretor OU roleta) e etiqueta (no site) de UM
 * destino do lead. Roleta e Responsável eram dois seletores; desde 06/10/2026 são
 * um só, com as abas Corretores | Roleta (CampoQuemAssume) — o lead sempre teve
 * um dono só: com responsável escolhido, a roleta não sorteava. Saiu da tela Configurar do portal (2026-09-30) quando o site ganhou o
 * mesmo bloco, duas vezes (venda e locação).
 *
 * Regras que vieram junto e não se reabrem:
 * - trocar o funil LIMPA a coluna (coluna de outro funil é recusada pelo servidor);
 * - escolha gravada que sumiu (funil apagado, roleta desativada, pessoa fora da
 *   lista) continua escolhida, com rótulo de aviso — senão o seletor abriria em
 *   branco e salvar trocaria a escolha sem ninguém ver.
 */
export default function LeadDestinationFields({ value, onChange, options, showLabel = false }: Props) {
  const { pipelines, roletas, users, labels } = options;
  const [stages, setStages] = useState<DestinationOpt[]>([]);

  useEffect(() => {
    setStages([]);
    if (!value.pipeline_id || pipelines === null) return;
    let ativo = true;
    pipelinesService.getPipelineStages(value.pipeline_id)
      .then(res => {
        if (ativo) setStages(((res?.data ?? []) as Array<{ id: string; name: string }>).map(s => ({ id: String(s.id), label: s.name })));
      })
      .catch(() => { if (ativo) setStages([]); });
    return () => { ativo = false; };
  }, [value.pipeline_id, pipelines]);

  const pipelineOptions = useMemo<DestinationOpt[]>(() => {
    if (!pipelines) return [];
    if (value.pipeline_id && !pipelines.some(p => p.id === value.pipeline_id)) {
      return [...pipelines, { id: value.pipeline_id, label: 'Funil escolhido (não existe mais)' }];
    }
    return pipelines;
  }, [pipelines, value.pipeline_id]);

  const pessoas = useMemo(
    () => (users ? users.map(u => ({ id: String(u.id), nome: u.name })) : null),
    [users],
  );

  const labelOptions = useMemo<DestinationOpt[]>(() => {
    if (!labels) return [];
    if (value.label_id && !labels.some(l => l.id === value.label_id)) {
      return [...labels, { id: value.label_id, label: 'Etiqueta escolhida (não existe mais)' }];
    }
    return labels;
  }, [labels, value.label_id]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pipelines !== null && (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Funil</span>
            <Seletor className="w-full"
              aria-label="Funil"
              value={value.pipeline_id}
              onChange={e => onChange({ pipeline_id: e.target.value, stage_id: '' })}
            >
              <option value="">Funil padrão do CRM</option>
              {pipelineOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Seletor>
          </label>
          {value.pipeline_id && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Coluna</span>
              <Seletor className="w-full"
                aria-label="Coluna"
                value={value.stage_id}
                onChange={e => onChange({ stage_id: e.target.value })}
              >
                <option value="">Primeira coluna do funil</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Seletor>
            </label>
          )}
        </>
      )}
      {(roletas !== null || users !== null) && (
        <div className="block space-y-1.5">
          <span className="text-sm font-medium">Quem assume o lead</span>
          <CampoQuemAssume
            aria-label="Quem assume o lead"
            value={{
              default_assignee_id: value.default_assignee_id || null,
              roleta_config_id: value.roleta_config_id || null,
            }}
            onChange={v => onChange({
              default_assignee_id: v.default_assignee_id ?? '',
              roleta_config_id: v.roleta_config_id ?? '',
            })}
            pessoas={pessoas}
            roletas={roletas}
          />
        </div>
      )}
      {showLabel && labels !== null && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Etiqueta</span>
          <Seletor className="w-full"
            aria-label="Etiqueta"
            value={value.label_id}
            onChange={e => onChange({ label_id: e.target.value })}
          >
            <option value="">Sem etiqueta</option>
            {labelOptions.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Seletor>
        </label>
      )}
    </div>
  );
}
