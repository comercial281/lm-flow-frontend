import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import {
  portalsService,
  PortalAdType,
  PortalSettings,
} from '@/services/portals/portalsService';
import { extractError } from '@/utils/apiHelpers';
import {
  investimentoNormalizado,
  investimentoParaTela,
  limiteNormalizado,
} from '@/features/portals/adPlan';

interface Props {
  portalKey: string;
  /** Na ordem do servidor; a cota atual de cada tipo vem em `limit`. */
  adTypes: PortalAdType[];
  settings?: PortalSettings | null;
  onSaved?: () => void;
}

const limitesDe = (adTypes: PortalAdType[]) =>
  Object.fromEntries(adTypes.map(t => [t.key, t.limit === null || t.limit === undefined ? '' : String(t.limit)]));

/**
 * *Plano de anúncios*: a cota contratada com o portal, por tipo de anúncio, e
 * o valor mensal do investimento. É a cota que o seletor de imóveis compara
 * para avisar do estouro — o portal não manda o plano dele para cá, então
 * quem digita é o gestor, olhando o contrato.
 *
 * 0 (ou vazio) = ilimitado, que é como o servidor grava "sem cota".
 */
export default function PortalAdPlanCard({ portalKey, adTypes, settings, onSaved }: Props) {
  const [limites, setLimites] = useState<Record<string, string>>(() => limitesDe(adTypes));
  const [investimento, setInvestimento] = useState(() => investimentoParaTela(settings?.monthly_investment));
  const [saving, setSaving] = useState(false);

  // O servidor é a fonte: depois do salvar (e de qualquer recarga) o card
  // volta a mostrar o que ficou gravado, não o que a pessoa digitou.
  useEffect(() => { setLimites(limitesDe(adTypes)); }, [adTypes]);
  useEffect(() => { setInvestimento(investimentoParaTela(settings?.monthly_investment)); }, [settings?.monthly_investment]);

  const ilimitados = useMemo(
    () => new Set(adTypes.filter(t => limiteNormalizado(limites[t.key] ?? '') === null).map(t => t.key)),
    [adTypes, limites],
  );

  const save = async () => {
    const valor = investimentoNormalizado(investimento);
    if (!valor.valido) {
      toast.error('Valor mensal inválido — use números, como 3.593,45');
      return;
    }
    const ad_plan: Record<string, number> = {};
    adTypes.forEach(t => { ad_plan[t.key] = limiteNormalizado(limites[t.key] ?? '') ?? 0; });

    setSaving(true);
    try {
      await portalsService.updateSettings(portalKey, { ad_plan, monthly_investment: valor.valor });
      toast.success('Plano salvo');
      onSaved?.();
    } catch (err) {
      toast.error(extractError(err).message || 'Erro ao salvar o plano');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-sm">Plano de anúncios</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quantos imóveis o seu plano no portal permite em cada tipo de anúncio. Passar da cota
          não trava o envio — a tela avisa e o portal rebaixa os que sobrarem para o tipo abaixo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {adTypes.map(t => {
          const id = `plano-${portalKey}-${t.key}`;
          return (
            <div key={t.key} className="space-y-1.5">
              <label htmlFor={id} className="text-sm font-medium">{t.label}</label>
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="0"
                  value={limites[t.key] ?? ''}
                  onChange={e => setLimites(prev => ({ ...prev, [t.key]: e.target.value }))}
                  className="w-32"
                />
                {ilimitados.has(t.key) && (
                  <span className="text-xs text-muted-foreground">0 = ilimitado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 max-w-xs">
        <label htmlFor={`investimento-${portalKey}`} className="text-sm font-medium">
          Valor mensal do investimento (R$)
        </label>
        <Input
          id={`investimento-${portalKey}`}
          type="text"
          inputMode="decimal"
          placeholder="3.593,45"
          value={investimento}
          onChange={e => setInvestimento(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Só para o seu controle — não vai para o portal.</p>
      </div>

      <div className="flex justify-end">
        <Button className="text-xs" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar plano'}
        </Button>
      </div>
    </div>
  );
}
