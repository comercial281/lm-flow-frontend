// src/pages/Customer/Properties/lista/CartaoGrade.tsx
import type { Property } from '@/services/properties/propertiesService';
import { PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import { dinheiro } from '@/lib/formato';
import { linhaDasTipologias, rotuloDaSituacao, seloDaFase, tipoDoImovel, tomDaSituacao } from '@/features/properties/listingKind';
import FotoDoImovel from './FotoDoImovel';
import Selo, { TOM_DA_FASE } from './SeloSituacao';
import MenuDoImovel, { estaNoSite, type AcoesDoImovel, type Permissoes } from './MenuDoImovel';
import { faixaDePreco } from './LinhaEmpreendimento';
import TituloDoImovel from './TituloDoImovel';

export default function CartaoGrade({ p, acoes, permissoes, forca }: {
  p: Property; acoes: AcoesDoImovel; permissoes: Permissoes; forca?: number;
}) {
  const emp = tipoDoImovel(p) === 'development';
  // Revenda sem bairro cai no título do cadastro (só o tipo diria pouco).
  const titulo = emp || !p.address_neighborhood ? p.title : [p.address_neighborhood, PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type].join(' · ');
  const preco = emp
    ? (faixaDePreco(p).de ? `a partir de ${dinheiro(faixaDePreco(p).de, { centavos: false })}` : null)
    : p.sale_price ? dinheiro(p.sale_price, { centavos: false }) : p.rent_price ? `${dinheiro(p.rent_price, { centavos: false })}/mês` : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <FotoDoImovel p={p} aoAdicionar={() => acoes.fotos(p)} compacta />
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex flex-wrap gap-1.5">
          {emp ? (
            <>
              <Selo tom={TOM_DA_FASE[p.stage] ?? 'neutro'}>{seloDaFase(p.stage, p.delivery_forecast)}</Selo>
              {p.status !== 'active' && <Selo tom={tomDaSituacao('development', p.status)}>{rotuloDaSituacao('development', p.status)}</Selo>}
            </>
          ) : <Selo tom={tomDaSituacao('resale', p.status)}>{rotuloDaSituacao('resale', p.status)}</Selo>}
        </div>
        <TituloDoImovel texto={titulo || p.title} podeEditar={permissoes.editar} aoAbrir={() => acoes.editar(p)}
          aoAbrirNoSite={estaNoSite(p) ? () => acoes.site(p) : undefined} className="text-[15px] font-semibold" />
        {emp && linhaDasTipologias(p.typologies) && <p className="text-xs text-muted-foreground">{linhaDasTipologias(p.typologies)}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-primary">{preco ?? 'Sem preço'}</span>
          <MenuDoImovel p={p} acoes={acoes} permissoes={permissoes} forca={forca} />
        </div>
      </div>
    </article>
  );
}
