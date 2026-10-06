import { dinheiro } from '@/lib/formato';
import type { MudancasDoPacote } from '@/types/admin/pacotes';

// Frases curtas da prévia ("liga Bolsão", "números de WhatsApp 5 → 2").
// Usado no editor de pacote e no Trocar/Voltar ao pacote do cliente.
export const ROTULO_DO_LIMITE = {
  max_whatsapp_channels: 'números de WhatsApp',
  ai_leads_included: 'franquia de leads da IA',
  ai_lead_overage_price_brl: 'preço do excedente',
} as const;

type ChaveDeLimite = keyof typeof ROTULO_DO_LIMITE;

/** Formato do diff do cliente (F8): o que o cliente tem × o que o pacote manda. */
export interface DiffDoCliente {
  features: { label: string; package: boolean }[];
  limits: { key: string; tenant: number | null; package: number | null }[];
}

function valor(key: ChaveDeLimite, v: number | null): string {
  if (key === 'max_whatsapp_channels') return v == null || v <= 0 ? 'ilimitado' : String(v);
  if (key === 'ai_leads_included') return v == null || v <= 0 ? 'sem franquia' : String(v);
  return dinheiro(v).replace(/ /g, ' ');
}

const ehDiffDoCliente = (m: MudancasDoPacote | DiffDoCliente): m is DiffDoCliente =>
  m.features.some((f) => 'package' in f) || m.limits.some((l) => 'tenant' in l);

export function resumoDeMudancas(m: MudancasDoPacote | DiffDoCliente): string[] {
  const linhas = ehDiffDoCliente(m)
    ? {
        funcoes: m.features.map((f) => ({ label: f.label, liga: f.package })),
        limites: m.limits.map((l) => ({ key: l.key as ChaveDeLimite, de: l.tenant, para: l.package })),
      }
    : {
        funcoes: m.features.map((f) => ({ label: f.label, liga: f.to })),
        limites: m.limits.map((l) => ({ key: l.key as ChaveDeLimite, de: l.from, para: l.to })),
      };
  return [
    ...linhas.funcoes.map((f) => `${f.liga ? 'liga' : 'desliga'} ${f.label}`),
    ...linhas.limites.map((l) => `${ROTULO_DO_LIMITE[l.key]} ${valor(l.key, l.de)} → ${valor(l.key, l.para)}`),
  ];
}
