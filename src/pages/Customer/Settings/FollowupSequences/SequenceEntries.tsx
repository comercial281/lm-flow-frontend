import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Button, Input, Label as UILabel, Badge } from '@/components/ui/ds';
import { Plus, Trash2, Loader2, AlertTriangle, Info } from 'lucide-react';
import {
  followupSequencesService,
  FollowupEntry,
  FollowupEntryKind,
  FollowupEntryKindOption,
  FollowupEntryStage,
  FollowupEntryFormData,
} from '@/services/followupSequences/followupSequencesService';

/**
 * "Quando este funil começa": as portas de entrada do funil.
 *
 * Antes existia UMA chave global — uma coluna, um funil, pra conta inteira — então
 * não dava pra ter a coluna Visita começando um funil e a coluna Proposta começando
 * outro. Agora a escolha é DO FUNIL, e ele pode ter quantas portas quiser.
 */

interface Props {
  sequenceId: string | null;
  sequenceName: string;
  /** Avisa a tela de cima pra atualizar o contador na lista de funis. */
  onChanged?: () => void;
}

const emptyForm: FollowupEntryFormData = { kind: 'stage', enabled: true };

export function SequenceEntries({ sequenceId, sequenceName, onChanged }: Props) {
  const [entries, setEntries] = useState<FollowupEntry[]>([]);
  const [kinds, setKinds] = useState<FollowupEntryKindOption[]>([]);
  const [stages, setStages] = useState<FollowupEntryStage[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FollowupEntryFormData | null>(null);

  const load = useCallback(async () => {
    if (!sequenceId) return;
    setLoading(true);
    try {
      const data = await followupSequencesService.getEntries(sequenceId);
      setEntries(data.entries ?? []);
      setKinds(data.kinds ?? []);
      setStages(data.stages ?? []);
      setLabels(data.labels ?? []);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível carregar as entradas deste funil.'));
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => { void load(); }, [load]);

  // Colunas agrupadas por pipeline. Num CRM com 3 pipelines de 6 colunas a lista
  // crua tem 18 itens com nomes repetidos ("Novo", "Contato") — sem o agrupamento
  // não dá pra saber qual coluna se está escolhendo.
  const stageGroups = useMemo(() => {
    const groups = new Map<string, { id: string; pipeline: string; stages: FollowupEntryStage[] }>();
    stages.forEach(s => {
      const group = groups.get(s.pipeline_id)
        ?? { id: s.pipeline_id, pipeline: s.pipeline_name || 'Pipeline sem nome', stages: [] };
      group.stages.push(s);
      groups.set(s.pipeline_id, group);
    });
    return Array.from(groups.values());
  }, [stages]);

  const needsOf = (kind: FollowupEntryKind) => kinds.find(k => k.value === kind)?.needs ?? null;

  // O que falta preencher pra entrada poder ser salva. Vira texto na tela e trava o
  // botão: antes dava pra clicar em salvar com o formulário recém-aberto e receber
  // um erro vermelho dizendo o que faltava — o que se lê como defeito, não como
  // "falta um campo".
  const missing = (f: FollowupEntryFormData): string | null => {
    switch (needsOf(f.kind)) {
      case 'stage_id':
        return f.stage_id ? null : 'Escolha a coluna que inicia o funil.';
      case 'label':
        return f.label?.trim() ? null : 'Escolha a etiqueta que inicia o funil.';
      case 'no_reply_minutes':
        return Number(f.no_reply_minutes) > 0 ? null : 'Diga em quantos minutos sem resposta o funil começa.';
      default:
        return null;
    }
  };

  const describe = (entry: FollowupEntry): string => {
    switch (entry.kind) {
      case 'stage': {
        const stage = stages.find(s => s.id === entry.stage_id);
        return stage ? `${stage.pipeline_name} → ${stage.name}` : 'coluna que não existe mais';
      }
      case 'label':
        return `etiqueta "${entry.tag}"`;
      case 'new_lead':
        return entry.paid_only ? 'só leads de anúncio' : 'qualquer lead novo';
      case 'no_reply':
        return `${entry.no_reply_minutes} min sem responder`;
      default:
        return '';
    }
  };

  const save = async () => {
    if (!sequenceId || !form) return;
    setSaving(true);
    try {
      await followupSequencesService.saveEntry(sequenceId, form);
      setForm(null);
      await load();
      onChanged?.();
      toast.success('Entrada salva.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível salvar a entrada.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (entry: FollowupEntry) => {
    if (!sequenceId) return;
    try {
      await followupSequencesService.saveEntry(sequenceId, {
        id: entry.id,
        kind: entry.kind,
        enabled: !entry.enabled,
        stage_id: entry.stage_id ?? undefined,
        label: entry.tag ?? undefined,
        paid_only: entry.paid_only,
        no_reply_minutes: entry.no_reply_minutes ?? undefined,
      });
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível mudar a entrada.'));
    }
  };

  const remove = async (entry: FollowupEntry) => {
    if (!sequenceId) return;
    try {
      await followupSequencesService.deleteEntry(sequenceId, entry.id);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível remover a entrada.'));
    }
  };

  // Funil que ainda não foi salvo não tem onde pendurar a entrada. Dizer isso é
  // melhor do que mostrar um formulário que vai falhar ao salvar.
  if (!sequenceId) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3">
        <h4 className="text-sm font-medium">Quando este funil começa</h4>
        <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Salve o funil primeiro. Depois você escolhe aqui o que faz ele começar —
          uma coluna, uma etiqueta, lead novo, e quantas portas quiser.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Quando este funil começa</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O que faz o lead entrar em <strong>{sequenceName || 'este funil'}</strong> sozinho.
            Pode ter mais de uma porta.
          </p>
        </div>
        {!form && (
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...emptyForm })}>
            <Plus className="mr-1 h-3 w-3" /> Adicionar entrada
          </Button>
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </p>
      )}

      {!loading && entries.length === 0 && !form && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          Sem entrada, este funil só roda quando alguém mandar pelo botão dentro do card.
          Nada dispara sozinho.
        </p>
      )}

      {entries.map(entry => (
        <div key={entry.id} className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="font-medium">{entry.label}</span>
            {describe(entry) && (
              <span className="ml-2 text-xs text-muted-foreground">{describe(entry)}</span>
            )}
          </div>
          {!entry.enabled && <Badge variant="outline" className="text-xs text-muted-foreground">desligada</Badge>}
          <Button type="button" variant="ghost" size="sm" onClick={() => void toggle(entry)}>
            {entry.enabled ? 'Desligar' : 'Ligar'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void remove(entry)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {form && (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div>
            {/* Select nativo de propósito: é o mesmo padrão dos outros seletores
                desta seção (coluna, origem), e trocar de gatilho precisa zerar o
                detalhe do anterior — senão a coluna escolhida antes viajaria junto
                com um gatilho de etiqueta. */}
            <UILabel className="text-xs" htmlFor="followup-entry-kind">O que faz o funil começar</UILabel>
            <select
              id="followup-entry-kind"
              value={form.kind}
              onChange={e => setForm({ ...emptyForm, kind: e.target.value as FollowupEntryKind })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {kinds.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          {needsOf(form.kind) === 'stage_id' && (
            stageGroups.length === 0 ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                Este CRM ainda não tem coluna nenhuma. Crie um pipeline antes de usar esta opção.
              </p>
            ) : (
              <div>
                <UILabel className="text-xs" htmlFor="followup-entry-stage">Coluna que inicia o funil</UILabel>
                <select
                  id="followup-entry-stage"
                  value={form.stage_id ?? ''}
                  onChange={e => setForm({ ...form, stage_id: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Escolha uma coluna...</option>
                  {stageGroups.map(g => (
                    <optgroup key={g.id} label={g.pipeline}>
                      {g.stages.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vale tanto pro card arrastado à mão quanto pro movido por outra automação.
                </p>
              </div>
            )
          )}

          {needsOf(form.kind) === 'label' && (
            <div>
              <UILabel className="text-xs" htmlFor="followup-entry-tag">Etiqueta que inicia o funil</UILabel>
              <Input
                id="followup-entry-tag"
                list="followup-entry-labels"
                value={form.label ?? ''}
                placeholder="Ex.: visitou"
                onChange={e => setForm({ ...form, label: e.target.value })}
              />
              <datalist id="followup-entry-labels">
                {labels.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
          )}

          {needsOf(form.kind) === 'paid_only' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.paid_only)}
                onChange={e => setForm({ ...form, paid_only: e.target.checked })}
              />
              Só leads de anúncio (tráfego pago)
            </label>
          )}

          {needsOf(form.kind) === 'no_reply_minutes' && (
            <div>
              <UILabel className="text-xs" htmlFor="followup-entry-minutes">Minutos sem responder</UILabel>
              <Input
                id="followup-entry-minutes"
                type="number"
                min={1}
                value={form.no_reply_minutes ?? ''}
                placeholder="Ex.: 60"
                onChange={e => setForm({ ...form, no_reply_minutes: Number(e.target.value) })}
              />
              {/* Quem procura leads sem resposta é a varredura da seção "Quem não
                  respondeu", e ela só roda com aquela chave ligada. Sem este aviso a
                  entrada fica configurada, com cara de pronta, e nunca dispara. */}
              <p className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>
                  Esta entrada depende da seção <strong>Quem não respondeu</strong>, no topo da
                  tela: é ela que procura os leads calados. Com aquela chave desligada, esta
                  entrada não dispara — e o tempo que vale é o de lá.
                </span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {missing(form) && (
              <span className="mr-auto text-xs text-muted-foreground">{missing(form)}</span>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || Boolean(missing(form))}
              onClick={() => void save()}
            >
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Salvar entrada
            </Button>
          </div>
        </div>
      )}

      {entries.length > 1 && (
        <p className="text-xs text-muted-foreground">
          O lead recebe <strong>um funil por vez</strong>: entrar por qualquer uma destas portas
          para o follow-up que estiver rodando, e o anterior guarda onde parou.
        </p>
      )}
    </div>
  );
}

export default SequenceEntries;
