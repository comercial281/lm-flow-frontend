import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchMetaAdAccounts, syncMetaAds, updateMetaAdsConfig,
  type MetaAdAccount,
} from '@/services/dashboard/metaAdsService';
import { EmptyBlock, formatCurrency, formatNumber, GlassCard } from './primitives';
import type { AdsBlock, Unavailable } from '../types';

/**
 * Anúncios × operação: quanto entrou de mídia e o que saiu do outro lado.
 *
 * Quando a conta ainda não foi escolhida, o card NÃO manda o usuário procurar
 * uma tela de configurações: ele lista as contas ali mesmo e salva. A lista vem
 * do token de sistema, então ninguém precisa colar token.
 */
const AccountPicker: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [accounts, setAccounts] = useState<MetaAdAccount[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMetaAdAccounts()
      .then(list => { if (alive) setAccounts(list); })
      .catch(() => { if (alive) setError('Não foi possível listar as contas de anúncio.'); });
    return () => { alive = false; };
  }, []);

  const choose = useCallback(async (account: MetaAdAccount) => {
    setSaving(true);
    try {
      await updateMetaAdsConfig({
        ad_account_id: account.id,
        ad_account_name: account.name,
        is_enabled: true,
      });
      // Primeira sincronização na hora: escolher a conta e continuar vendo o
      // card vazio até o job das 6h rodar pareceria que não funcionou.
      const result = await syncMetaAds(30);
      toast.success(`Conta conectada · ${formatNumber(result.rows ?? 0)} registros importados`);
      onDone();
    } catch {
      toast.error('Não foi possível conectar a conta.');
    } finally {
      setSaving(false);
    }
  }, [onDone]);

  if (error) return <EmptyBlock text={error} />;
  if (!accounts) return <EmptyBlock text="Carregando contas de anúncio…" />;
  if (accounts.length === 0) return <EmptyBlock text="Nenhuma conta de anúncio visível para este acesso." />;

  return (
    <div>
      <p className="lmf-card-sub" style={{ marginBottom: 10 }}>
        Escolha a conta de anúncios deste cliente para ver gasto, custo por lead e custo por visita.
      </p>
      <ul style={{ maxHeight: 260, overflowY: 'auto' }}>
        {accounts.map(account => (
          <li key={account.id} className="lmf-row">
            <span className="min-w-0">
              <div className="lmf-row-title truncate">{account.name}</div>
              <div className="lmf-row-sub">{account.id} · {account.status}</div>
            </span>
            <button
              type="button"
              className="lmf-select"
              disabled={saving}
              onClick={() => choose(account)}
            >
              {saving ? 'Conectando…' : 'Usar esta'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em', marginTop: 6 }}>{value}</div>
    {hint && <div className="lmf-row-sub">{hint}</div>}
  </div>
);

export const AdsSection: React.FC<{
  ads: AdsBlock | Unavailable | undefined;
  onReload: () => void;
}> = ({ ads, onReload }) => {
  const [syncing, setSyncing] = useState(false);
  const unavailable = ads as Unavailable | undefined;
  const naoConfigurado = unavailable?.available === false && unavailable.reason === 'not_configured';
  const disponivel = !!ads && (ads as Unavailable).available !== false;
  const data = disponivel ? (ads as AdsBlock) : null;

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncMetaAds(14);
      toast.success(`${formatNumber(result.rows ?? 0)} registros atualizados`);
      onReload();
    } catch {
      toast.error('Não foi possível sincronizar agora.');
    } finally {
      setSyncing(false);
    }
  }, [onReload]);

  return (
    <GlassCard
      title="Marketing e anúncios"
      subtitle={
        data
          ? `${data.account.name || data.account.id}${data.last_synced_at ? ` · atualizado ${new Date(data.last_synced_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}`
          : 'Investimento em mídia cruzado com leads e visitas'
      }
      action={
        data ? (
          <button type="button" className="lmf-select flex items-center gap-2" onClick={sync} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} />
            Sincronizar
          </button>
        ) : undefined
      }
    >
      {naoConfigurado && <AccountPicker onDone={onReload} />}

      {!naoConfigurado && !data && <EmptyBlock block={unavailable} />}

      {data && (
        <>
          <div className="lmf-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Metric label="Investido" value={formatCurrency(data.spend)} />
            <Metric
              label="Custo por lead"
              value={data.cost_per_lead === null ? '—' : formatCurrency(data.cost_per_lead)}
              hint={`${formatNumber(data.crm.leads)} leads no CRM`}
            />
            <Metric
              label="Custo por visita"
              value={data.cost_per_visit === null ? '—' : formatCurrency(data.cost_per_visit)}
              hint={`${formatNumber(data.crm.visits)} visitas`}
            />
            <Metric
              label="Custo por venda"
              value={data.cost_per_sale === null ? '—' : formatCurrency(data.cost_per_sale)}
              hint={`${formatNumber(data.crm.sales)} vendas`}
            />
          </div>

          <div className="lmf-row" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--lmf-border)', borderBottom: 0 }}>
            <span className="lmf-row-sub">
              {formatNumber(data.impressions)} impressões · {formatNumber(data.clicks)} cliques ·{' '}
              {formatNumber(data.meta_leads)} leads na Meta · {formatNumber(data.messaging_starts)} conversas iniciadas
            </span>
          </div>

          {data.campaigns.length > 0 && (
            <>
              <h3 style={{ fontSize: 12, color: 'var(--lmf-muted)', margin: '14px 0 4px' }}>Campanhas por investimento</h3>
              <ul>
                {data.campaigns.map(campaign => (
                  <li key={campaign.id} className="lmf-row">
                    <span className="min-w-0">
                      <div className="lmf-row-title truncate">{campaign.name || campaign.id}</div>
                      <div className="lmf-row-sub">
                        {formatNumber(campaign.leads)} leads · {formatNumber(campaign.clicks)} cliques
                      </div>
                    </span>
                    <span className="lmf-pill">{formatCurrency(campaign.spend)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </GlassCard>
  );
};

export default AdsSection;
