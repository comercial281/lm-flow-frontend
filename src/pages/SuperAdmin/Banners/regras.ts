// Regras de texto e data do Banner da Dashboard, fora do JSX pra ter teste.
import { plural } from '@/lib/formato';
import type { CargoDoBanner, PublicoDoBanner, SituacaoDoBanner } from '@/types/admin/dashboardBanners';

export const NOME_DA_SITUACAO: Record<SituacaoDoBanner, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  live: 'No ar',
  ended: 'Encerrado',
};

export const CARGOS: { valor: CargoDoBanner; rotulo: string }[] = [
  { valor: 'admin', rotulo: 'Administrador' },
  { valor: 'manager', rotulo: 'Gestor' },
  { valor: 'agent', rotulo: 'Corretor' },
];

/** Medida pedida em cada arte (a mesma que o servidor exige). */
export const MEDIDA_DA_ARTE = {
  desktop: '2800 × 560 px (5:1)',
  mobile: '1080 × 540 px (2:1)',
} as const;

/** "Apareceu para 280 · 94 clicaram". */
export function numerosDoBanner(vistos: number, cliques: number): string {
  return `Apareceu para ${plural(vistos, 'pessoa', 'pessoas')} · ${cliques} ${cliques === 1 ? 'clicou' : 'clicaram'}`;
}

/** "Mostrar para 340 pessoas de 31 imobiliárias?" */
export function perguntaDoPublico(publico: PublicoDoBanner): string {
  return `Mostrar para ${plural(publico.people, 'pessoa', 'pessoas')} de ${plural(publico.tenants, 'imobiliária', 'imobiliárias')}?`;
}

/** Data do servidor (ISO) → valor do campo de data e hora do navegador, no fuso de quem usa. */
export function paraOCampo(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor do campo de data e hora → ISO pro servidor. Vazio = null. */
export function doCampo(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
