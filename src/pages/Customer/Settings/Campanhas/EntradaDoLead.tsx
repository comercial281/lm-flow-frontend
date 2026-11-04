/**
 * Os campos da "Entrada do lead" de um formulário do Meta (coluna esquerda da janela da campanha, 04/11/2026):
 * funil e etapa, quem assume (no topo), etiquetas e ativo (no fim, depois do que a campanha vende). O "Nome do imóvel para reconhecer os formulários" saiu: quem
 * liga lead a ficha é o `form_id`, não uma palavra no nome.
 */
import type { ComponentProps } from 'react';
import { Checkbox, Label as UILabel } from '@/components/ui/ds';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { Seletor } from '@/components/base/Seletor';
import CampoQuemAssume, { type QuemAssume } from '@/components/roleta/CampoQuemAssume';
import LabelMultiSelect from '@/components/labels/LabelMultiSelect';
import type { useAutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';

export interface EntradaEmEdicao {
  pipeline_id: string;
  pipeline_stage_id: string;
  label_ids: string[];
  quem: QuemAssume;
  is_active: boolean;
}

type Recursos = Pick<ReturnType<typeof useAutomationResources>, 'pipelines' | 'stagesByPipeline' | 'labels' | 'users' | 'reloadLabels'>;

const campo = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';

/** A primeira metade, no topo da janela: pra onde o lead vai e quem assume. O resto (etiquetas, estado) é `ComplementoDaEntrada`. */
export default function EntradaDoLead({ valor, aoMudar, recursos, roletas }: {
  valor: EntradaEmEdicao;
  aoMudar: (parcial: Partial<EntradaEmEdicao>) => void;
  recursos: Recursos;
  roletas: ComponentProps<typeof CampoQuemAssume>['roletas'];
}) {
  return (
    <>
      <GrupoDaJanela titulo="Para onde vai">
        <GradeDaJanela>
          <CampoDaJanela rotulo="Funil" htmlFor="destino_funil" obrigatorio colunas={valor.pipeline_id ? 2 : 4}>
            <Seletor id="destino_funil" value={valor.pipeline_id} className={campo}
              onChange={e => aoMudar({ pipeline_id: e.target.value, pipeline_stage_id: '' })}>
              <option value="">Escolha um funil</option>
              {recursos.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Seletor>
          </CampoDaJanela>

          {valor.pipeline_id && (
            <CampoDaJanela rotulo="Etapa" htmlFor="destino_etapa" obrigatorio colunas={2}>
              <Seletor id="destino_etapa" value={valor.pipeline_stage_id} className={campo}
                onChange={e => aoMudar({ pipeline_stage_id: e.target.value })}>
                <option value="">Escolha uma etapa</option>
                {(recursos.stagesByPipeline[valor.pipeline_id] ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Seletor>
            </CampoDaJanela>
          )}
        </GradeDaJanela>
      </GrupoDaJanela>

      {/* Corretor fixo OU roleta, numa lista só com as abas Corretores | Roleta. A tela só ESCOLHE a roleta. */}
      <GrupoDaJanela titulo="Quem assume">
        <CampoDaJanela
          rotulo="Quem assume o lead"
          htmlFor="quem_assume"
          ajuda="O corretor recebe todo lead deste formulário. A roleta oferece cada lead ao próximo da fila."
        >
          <CampoQuemAssume
            id="quem_assume"
            aria-label="Quem assume o lead"
            value={valor.quem}
            onChange={quem => aoMudar({ quem })}
            pessoas={recursos.users.filter(u => !u.deactivated).map(u => ({ id: String(u.id), nome: u.name }))}
            roletas={roletas}
          />
        </CampoDaJanela>
      </GrupoDaJanela>
    </>
  );
}

/** A segunda metade, depois do que a campanha vende: etiquetas e se a ficha está ativa. */
export function ComplementoDaEntrada({ valor, aoMudar, recursos }: {
  valor: EntradaEmEdicao;
  aoMudar: (parcial: Partial<EntradaEmEdicao>) => void;
  recursos: Recursos;
}) {
  return (
    <>
      <GrupoDaJanela titulo="Complemento">
        <CampoDaJanela
          rotulo="Etiquetas"
          ajuda={<>Já vem com <strong>tráfego pago</strong> por padrão. Busque ou crie a etiqueta do imóvel deste formulário.</>}
        >
          <LabelMultiSelect
            labels={recursos.labels}
            selectedIds={valor.label_ids}
            onChange={ids => aoMudar({ label_ids: ids })}
            onLabelCreated={() => recursos.reloadLabels()}
          />
        </CampoDaJanela>
      </GrupoDaJanela>

      <GrupoDaJanela titulo="Estado">
        <div className="flex items-center gap-2">
          <Checkbox id="is_active" checked={valor.is_active} onCheckedChange={v => aoMudar({ is_active: v === true })} />
          <UILabel htmlFor="is_active" className="cursor-pointer">Ativo</UILabel>
        </div>
      </GrupoDaJanela>
    </>
  );
}
