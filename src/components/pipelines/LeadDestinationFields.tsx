import { useEffect, useMemo, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaLabel } from '@/services/roletaConfig/roletaConfigService';
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
 * Funil, coluna, roleta, responsável (e etiqueta, no site) de UM destino do
 * lead. Saiu da tela Configurar do portal (2026-09-30) quando o site ganhou o
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

  const roletaOptions = useMemo<DestinationOpt[]>(() => {
    if (!roletas) return [];
    const opts = roletas.filter(r => r.is_active).map(r => ({ id: r.id, label: roletaLabel(r) }));
    if (value.roleta_config_id && !opts.some(o => o.id === value.roleta_config_id)) {
      opts.push({ id: value.roleta_config_id, label: 'Roleta escolhida (desativada)' });
    }
    return opts;
  }, [roletas, value.roleta_config_id]);
  const roletaDesativada =
    !!value.roleta_config_id && !!roletas && !roletas.some(r => r.id === value.roleta_config_id && r.is_active);

  const userOptions = useMemo<DestinationOpt[]>(() => {
    if (!users) return [];
    const opts = users.map(u => ({ id: u.id, label: u.name }));
    if (value.default_assignee_id && !opts.some(o => o.id === value.default_assignee_id)) {
      opts.push({ id: value.default_assignee_id, label: 'Responsável escolhido (fora da lista)' });
    }
    return opts;
  }, [users, value.default_assignee_id]);

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
            <NativeSelect
              aria-label="Funil"
              value={value.pipeline_id}
              onChange={e => onChange({ pipeline_id: e.target.value, stage_id: '' })}
            >
              <option value="">Funil padrão do CRM</option>
              {pipelineOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </NativeSelect>
          </label>
          {value.pipeline_id && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Coluna</span>
              <NativeSelect
                aria-label="Coluna"
                value={value.stage_id}
                onChange={e => onChange({ stage_id: e.target.value })}
              >
                <option value="">Primeira coluna do funil</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </NativeSelect>
            </label>
          )}
        </>
      )}
      {roletas !== null && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Roleta</span>
          <NativeSelect
            aria-label="Roleta"
            value={value.roleta_config_id}
            onChange={e => onChange({ roleta_config_id: e.target.value })}
          >
            <option value="">Não distribuir (entra sem responsável)</option>
            {roletaOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </NativeSelect>
          {roletaDesativada && (
            <span className="block text-[11px] text-amber-600">
              Esta roleta está desativada: enquanto ela não for religada, o lead continua
              entrando sem responsável.
            </span>
          )}
        </label>
      )}
      {users !== null && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Responsável</span>
          <NativeSelect
            aria-label="Responsável"
            value={value.default_assignee_id}
            onChange={e => onChange({ default_assignee_id: e.target.value })}
          >
            <option value="">Ninguém</option>
            {userOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </NativeSelect>
          {value.roleta_config_id && value.default_assignee_id && (
            <span className="block text-[11px] text-muted-foreground">
              Com responsável escolhido, o lead vai direto para ele — a roleta não sorteia.
            </span>
          )}
        </label>
      )}
      {showLabel && labels !== null && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Etiqueta</span>
          <NativeSelect
            aria-label="Etiqueta"
            value={value.label_id}
            onChange={e => onChange({ label_id: e.target.value })}
          >
            <option value="">Sem etiqueta</option>
            {labelOptions.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </NativeSelect>
        </label>
      )}
    </div>
  );
}
