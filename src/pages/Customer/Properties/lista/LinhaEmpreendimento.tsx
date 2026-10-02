// src/pages/Customer/Properties/lista/LinhaEmpreendimento.tsx
import { UserCheck } from 'lucide-react';
import type { Property } from '@/services/properties/propertiesService';
import { dinheiro, tempoDesde } from '@/lib/formato';
import { linhaDasTipologias, rotuloDaSituacao, seloDaFase, textoDasUnidades, tomDaSituacao } from '@/features/properties/listingKind';
import FotoDoImovel from './FotoDoImovel';
import Selo, { TOM_DA_FASE } from './SeloSituacao';
import MenuDoImovel, { type AcoesDoImovel, type Permissoes } from './MenuDoImovel';

export function faixaDePreco(p: Property): { de: number | null; ate: number | null } {
  const precos = (p.typologies ?? []).map(t => Number(t.sale_price)).filter(n => n > 0);
  if (!precos.length) return { de: p.sale_price ?? null, ate: null };
  const de = Math.min(...precos);
  const ate = Math.max(...precos);
  return { de, ate: ate > de ? ate : null };
}

export default function LinhaEmpreendimento({ p, acoes, permissoes, forca }: {
  p: Property; acoes: AcoesDoImovel; permissoes: Permissoes; forca?: number;
}) {
  const { de, ate } = faixaDePreco(p);
  const tipologias = linhaDasTipologias(p.typologies);
  const unidades = textoDasUnidades(p.units_available_total, p.status);
  const lugar = [p.address_neighborhood, p.address_city].filter(Boolean).join(' · ');

  return (
    <article className="grid grid-cols-[110px_minmax(0,1fr)_40px] overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/40 sm:grid-cols-[200px_minmax(0,1fr)_220px_40px]">
      <FotoDoImovel p={p} aoAdicionar={() => acoes.fotos(p)} />
      <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Selo tom={TOM_DA_FASE[p.stage] ?? 'neutro'}>{seloDaFase(p.stage, p.delivery_forecast)}</Selo>
          {p.status !== 'active' && <Selo tom={tomDaSituacao('development', p.status)}>{rotuloDaSituacao('development', p.status)}</Selo>}
        </div>
        <button type="button" onClick={() => acoes.editar(p)} className="text-left font-semibold text-[15px] hover:text-primary sm:text-base">{p.title}</button>
        {lugar && <p className="truncate text-xs text-muted-foreground">{lugar}</p>}
        {tipologias && <p className="text-[13px]">{tipologias}</p>}
        {unidades && <p className="text-[13px] font-medium">{unidades}</p>}
        <p className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-xs text-muted-foreground">
          <span>Atualizado {tempoDesde(p.updated_at)}</span>
          <span>{p.responsible?.name ? `Responsável: ${p.responsible.name}` : 'Sem responsável'}</span>
          {p.lead_goes_to_responsible && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <UserCheck className="h-3 w-3" />Leads vão direto para {p.responsible?.name || 'o responsável'}
            </span>
          )}
        </p>
      </div>
      <div className="col-span-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:flex-nowrap sm:border-l sm:border-t-0">
        {de ? <div><span>A partir de</span><b className="block text-xl text-primary">{dinheiro(de, { centavos: false })}</b></div> : <span>Sem preço cadastrado</span>}
        {ate ? <div>até {dinheiro(ate, { centavos: false })}</div> : null}
      </div>
      <div className="col-start-3 row-start-1 flex justify-center pt-2 sm:col-start-4">
        <MenuDoImovel p={p} acoes={acoes} permissoes={permissoes} forca={forca} />
      </div>
    </article>
  );
}
