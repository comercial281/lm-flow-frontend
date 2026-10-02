// src/pages/Customer/Properties/lista/LinhaRevenda.tsx
import { UserCheck } from 'lucide-react';
import type { Property } from '@/services/properties/propertiesService';
import { PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import { dinheiro, numero, tempoDesde } from '@/lib/formato';
import { rotuloDaSituacao, tomDaSituacao } from '@/features/properties/listingKind';
import FotoDoImovel from './FotoDoImovel';
import Selo from './SeloSituacao';
import MenuDoImovel, { type AcoesDoImovel, type Permissoes } from './MenuDoImovel';
import TituloDoImovel from './TituloDoImovel';

const FINALIDADE: Record<string, string> = { sale: 'Venda', rent: 'Locação', sale_rent: 'Venda e locação', season: 'Temporada' };
const reais = (v?: number | null) => (v ? dinheiro(v, { centavos: false }) : null);

export default function LinhaRevenda({ p, acoes, permissoes, forca }: {
  p: Property; acoes: AcoesDoImovel; permissoes: Permissoes; forca?: number;
}) {
  const tipo = PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type;
  // Sem bairro, o título do cadastro diz mais do que só o tipo.
  const titulo = p.address_neighborhood ? `${p.address_neighborhood} · ${tipo}` : p.title;
  const endereco = [p.address_street && [p.address_street, p.address_number].filter(Boolean).join(', '), p.address_complement, p.address_city]
    .filter(Boolean).join(' · ');
  const util = Number(p.useful_area_m2 ?? 0);
  const area = util > 0 ? util : Number(p.total_area_m2 ?? 0);
  const terreno = /lot|terreno/.test(p.property_type);
  const tipoDeArea = terreno ? 'de terreno' : util > 0 ? 'úteis' : 'de área total';
  const semPreco = !p.sale_price && !p.rent_price && !p.condo_fee && !p.iptu;

  return (
    <article className="grid grid-cols-[110px_minmax(0,1fr)_40px] overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/40 sm:grid-cols-[200px_minmax(0,1fr)_220px_40px]">
      <FotoDoImovel p={p} aoAdicionar={() => acoes.fotos(p)} />
      <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Selo tom={tomDaSituacao('resale', p.status)}>{rotuloDaSituacao('resale', p.status)}</Selo>
          <Selo tom="neutro">{FINALIDADE[p.transaction_type] ?? p.transaction_type}</Selo>
        </div>
        <TituloDoImovel texto={titulo || tipo} podeEditar={permissoes.editar} aoAbrir={() => acoes.editar(p)} className="font-semibold text-[15px] sm:text-base" />
        {endereco && <p className="truncate text-xs text-muted-foreground">{endereco}</p>}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {p.bedrooms ? <span><b className="text-base">{p.bedrooms}</b> dorm{p.bedrooms > 1 ? 's' : ''}</span> : null}
          {p.suites ? <span><b className="text-base">{p.suites}</b> suíte{p.suites > 1 ? 's' : ''}</span> : null}
          {p.parking_spaces ? <span><b className="text-base">{p.parking_spaces}</b> vaga{p.parking_spaces > 1 ? 's' : ''}</span> : null}
          {area > 0 && <span><b className="text-base">{numero(area, 2)}</b> m² {tipoDeArea}</span>}
        </p>
        <p className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-xs text-muted-foreground">
          <span>Atualizado {tempoDesde(p.updated_at)}</span>
          {p.captor?.name && <span>Captador: {p.captor.name}</span>}
          {p.lead_goes_to_responsible && (
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <UserCheck className="h-3 w-3" />Leads vão direto para {p.responsible?.name || 'o responsável'}
            </span>
          )}
        </p>
      </div>
      <div className="col-span-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:flex-nowrap sm:border-l sm:border-t-0">
        {semPreco && <span>Sem preço cadastrado</span>}
        {p.sale_price ? (
          <div><span>Venda </span><b className="text-lg text-primary">{reais(p.sale_price)}</b>
            {area > 0 && <span className="block">{dinheiro(p.sale_price / area, { centavos: false })}/m²</span>}</div>
        ) : null}
        {p.rent_price ? <div><span>Locação </span><b className="text-lg text-primary">{reais(p.rent_price)}</b>/mês</div> : null}
        {p.condo_fee ? <div>Condomínio <span className="text-foreground">{reais(p.condo_fee)}</span></div> : null}
        {p.iptu ? <div>IPTU <span className="text-foreground">{reais(p.iptu)}</span></div> : null}
      </div>
      <div className="col-start-3 row-start-1 flex justify-center pt-2 sm:col-start-4">
        <MenuDoImovel p={p} acoes={acoes} permissoes={permissoes} forca={forca} />
      </div>
    </article>
  );
}
