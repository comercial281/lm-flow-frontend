import { Bot } from 'lucide-react';
import type { AiUsage } from '@/types/admin/clientes';

// Cor da barra por situação da franquia. Verde/âmbar/vermelho só quando existe
// franquia contratada; sem franquia a barra não aparece, porque não há de quê.
const FRANCHISE_BAR: Record<string, string> = {
  ok: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  estourado: 'bg-red-500',
  sem_franquia: 'bg-violet-500',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// De onde veio a cotação, para o texto que aparece ao passar o mouse no custo.
// Número de dinheiro em tela sem dizer de onde veio e de quando é vira discussão
// na hora de faturar.
function rateNote(u: AiUsage): string {
  // Dólar e cotação com 4 casas, não 2. Este texto existe para alguém CONFERIR
  // a conta, então os dois números precisam ser os mesmos que a conta usou:
  // arredondados (US$ 2,76 × R$ 5,16) dão R$ 14,24 onde a tela mostra R$ 14,25,
  // e numa tela de dinheiro é assim que nasce discussão sobre a fatura.
  const dec = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
  const rate = u.usd_brl_rate.toLocaleString('pt-BR', dec);
  const base = `US$ ${u.cost_usd.toLocaleString('en-US', dec)} · dólar a R$ ${rate}`;
  if (u.usd_brl_source === 'fallback') return `${base} (cotação indisponível, valor de referência)`;
  if (u.usd_brl_source === 'config') return `${base} (cotação fixada na configuração)`;
  const at = u.usd_brl_at ? new Date(u.usd_brl_at).toLocaleString('pt-BR') : null;
  return at ? `${base} (cotação de ${at})` : base;
}

// Linha de consumo de IA no cartão do cliente: quanto ele usou, quanto tem
// direito, quanto custou e quanto isso vira de excedente a cobrar.
// Tudo em real, que é a moeda em que se decide preço aqui. O dólar (que é como a
// Anthropic cobra) e a cotação usada ficam no texto ao passar o mouse: some da
// leitura do dia a dia sem sumir de quem precisa conferir a conta.
export default function AiUsageLine({ u }: { u?: AiUsage }) {
  if (!u) return null;
  const pct = u.usage_pct;
  return (
    <div className="mt-2">
      <div className="text-xs text-muted-foreground flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
        <Bot className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {u.ai_leads} lead{u.ai_leads === 1 ? '' : 's'} na IA
          {u.ai_leads_included ? ` de ${u.ai_leads_included}` : ''}
        </span>
        {!u.ai_leads_included && <span className="opacity-60">sem franquia</span>}
        <span className="opacity-60 cursor-help" title={rateNote(u)}>
          custo R$ {brl(u.cost_brl)}
          {u.usd_brl_source === 'fallback' && '*'}
        </span>
        {u.overage_leads > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            excedente {u.overage_leads} = R$ {brl(u.overage_amount_brl)}
          </span>
        )}
      </div>
      {typeof pct === 'number' && (
        <div className="h-1 mt-1.5 rounded-full bg-border overflow-hidden">
          <div className={`h-full rounded-full ${FRANCHISE_BAR[u.franchise_status] || 'bg-violet-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
    </div>
  );
}
