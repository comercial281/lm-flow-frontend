import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BarraSalvar from '@/components/base/BarraSalvar';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
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
 * Aba *Plano* do portal: a cota contratada com o portal, por tipo de anúncio, e
 * o valor mensal do investimento. É a cota que a aba Imóveis compara para
 * avisar do estouro — o portal não manda o plano dele para cá, então quem
 * digita é o gestor, olhando o contrato.
 *
 * 0 (ou vazio) = ilimitado, que é como o servidor grava "sem cota". Campo espera
 * o Salvar da BarraSalvar (padrão da casa desde o redesenho de 12/10/2026).
 */
export default function PortalAdPlanCard({ portalKey, adTypes, settings, onSaved }: Props) {
  const limitesGravados = useMemo(() => limitesDe(adTypes), [adTypes]);
  const investimentoGravado = investimentoParaTela(settings?.monthly_investment);
  const [limites, setLimites] = useState<Record<string, string>>(limitesGravados);
  const [investimento, setInvestimento] = useState(investimentoGravado);
  const [saving, setSaving] = useState(false);

  // O servidor é a fonte: depois do salvar (e de qualquer recarga) a aba
  // volta a mostrar o que ficou gravado, não o que a pessoa digitou.
  useEffect(() => { setLimites(limitesGravados); }, [limitesGravados]);
  useEffect(() => { setInvestimento(investimentoGravado); }, [investimentoGravado]);

  const temAlteracao = !mesmoConteudo(limites, limitesGravados) || investimento !== investimentoGravado;
  useAlteracoesNaoSalvas(temAlteracao);

  const ilimitados = useMemo(
    () => new Set(adTypes.filter(t => limiteNormalizado(limites[t.key] ?? '') === null).map(t => t.key)),
    [adTypes, limites],
  );

  const descartar = () => {
    setLimites(limitesGravados);
    setInvestimento(investimentoGravado);
  };

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
    <>
      <Secoes>
        <Secao
          titulo="Cota por tipo de anúncio"
          descricao="Quantos imóveis o seu plano no portal permite em cada tipo de anúncio. Passar da cota não trava o envio: a aba Imóveis avisa e o portal rebaixa os que sobrarem para o tipo abaixo."
        >
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
        </Secao>

        <Secao titulo="Investimento" descricao="Só para o seu controle: não vai para o portal.">
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
          </div>
        </Secao>
      </Secoes>
      <BarraSalvar visivel={temAlteracao} salvando={saving} aoSalvar={save} aoDescartar={descartar} />
    </>
  );
}
