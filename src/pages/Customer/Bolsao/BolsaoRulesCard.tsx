import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import bolsaoService, { BolsaoSettings } from '@/services/bolsao/bolsaoService';
import { pipelinesService } from '@/services/pipelines';
import type { Pipeline, PipelineStage } from '@/types/analytics';

const NO_PIPELINE = '__none__';

/**
 * As regras PADRÃO do cliente. Cada lista pode ter as suas; deixar em branco lá
 * faz a lista herdar daqui.
 */
export default function BolsaoRulesCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Partial<BolsaoSettings>>({});
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, pls] = await Promise.all([
          bolsaoService.getRules(),
          // include_items: false = modo enxuto. Aqui só precisamos do NOME do
          // funil; trazer os cards de todos eles para preencher um seletor
          // seria carregar o board inteiro à toa.
          pipelinesService.getPipelines({ per_page: 100, include_items: false }).catch(() => null),
        ]);
        setRules(cfg);
        setPipelines(pls?.data ?? []);
      } catch (e) {
        toast.error(apiErrorMessage(e, 'Não consegui carregar as regras do Bolsão.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // As colunas dependem do funil escolhido; sem recarregar, o gestor escolheria
  // uma coluna que não existe no funil que ele acabou de selecionar.
  useEffect(() => {
    const id = rules.target_pipeline_id;
    if (!id) {
      setStages([]);
      return;
    }
    pipelinesService
      .getPipeline(id)
      .then(p => setStages(p.stages ?? []))
      .catch(() => setStages([]));
  }, [rules.target_pipeline_id]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await bolsaoService.saveRules(rules);
      setRules(saved);
      toast.success('Regras do Bolsão salvas.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui salvar as regras.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando regras…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5" /> Regras do Bolsão
        </CardTitle>
        <CardDescription>
          Valem para todas as listas. Cada lista pode ter regra própria — deixando o campo em branco
          lá, ela usa o que estiver aqui.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="claims">Quantos leads por vez</Label>
            <Input
              id="claims"
              type="number"
              min={1}
              className="mt-1"
              value={rules.claims_per_window ?? ''}
              onChange={e => setRules(r => ({ ...r, claims_per_window: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="window">A cada quantos minutos</Label>
            <Input
              id="window"
              type="number"
              min={1}
              className="mt-1"
              value={rules.window_minutes ?? ''}
              onChange={e => setRules(r => ({ ...r, window_minutes: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          O corretor vê esse limite na tela dele, com o tempo que falta para poder pegar de novo.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Funil de destino</Label>
            <Select
              value={rules.target_pipeline_id ?? NO_PIPELINE}
              onValueChange={v =>
                setRules(r => ({
                  ...r,
                  target_pipeline_id: v === NO_PIPELINE ? null : v,
                  target_stage_id: null,
                }))
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Funil padrão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PIPELINE}>Funil padrão</SelectItem>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Coluna de entrada</Label>
            <Select
              value={rules.target_stage_id ?? NO_PIPELINE}
              onValueChange={v => setRules(r => ({ ...r, target_stage_id: v === NO_PIPELINE ? null : v }))}
              disabled={!rules.target_pipeline_id}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Primeira coluna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PIPELINE}>Primeira coluna</SelectItem>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="label">Etiqueta aplicada ao lead</Label>
          <Input
            id="label"
            className="mt-1"
            placeholder="bolsao"
            value={rules.label ?? ''}
            onChange={e => setRules(r => ({ ...r, label: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            É por ela que você filtra depois quem veio do Bolsão. Em branco, nenhuma etiqueta é
            aplicada.
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Salvar regras
        </Button>
      </CardContent>
    </Card>
  );
}
