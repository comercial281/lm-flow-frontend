import { Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import type { PadraoDoImovel } from '@/services/properties/propertiesService';
import { CampoSimNao } from './campos';
import { CLASSE_SELETOR, type PropsDaSecao } from './tipos';

const PADROES: { valor: PadraoDoImovel; rotulo: string }[] = [
  { valor: 'economic', rotulo: 'Econômico' },
  { valor: 'medium', rotulo: 'Médio' },
  { valor: 'high', rotulo: 'Alto' },
  { valor: 'luxury', rotulo: 'Luxo' },
];

// Os dois tipos. Destaque, Publicar no site e Encontrável pela IA seguem aqui
// até "Onde divulgar" (B6) assumir.
export default function SecaoDetalhesDaVenda({ form: f, setF }: PropsDaSecao) {
  const revenda = (f.listing_kind ?? 'resale') === 'resale';
  return (
    <div className="mt-4 space-y-4">
      <CampoSimNao rotulo="Aceita financiamento" valor={f.accepts_financing} aoMudar={v => setF({ accepts_financing: v })} />
      <CampoSimNao rotulo="Aceita FGTS" valor={f.accepts_fgts} aoMudar={v => setF({ accepts_fgts: v })} />
      <CampoSimNao rotulo="Minha Casa Minha Vida" valor={f.mcmv} aoMudar={v => setF({ mcmv: v })} />
      <div className="max-w-xs">
        <UILabel htmlFor="campo-padrao">Padrão</UILabel>
        <Seletor id="campo-padrao" value={f.building_standard ?? ''}
          onChange={e => setF({ building_standard: (e.target.value || null) as PadraoDoImovel | null })}
          className={CLASSE_SELETOR}>
          <option value="">—</option>
          {PADROES.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
        </Seletor>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {revenda && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.exclusive ?? false} onChange={e => setF({ exclusive: e.target.checked })} className="rounded" />
            <span className="text-sm">Exclusividade</span>
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={f.featured} onChange={e => setF({ featured: e.target.checked })} className="rounded" />
          <span className="text-sm">Destaque</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={f.published_on_site ?? false} onChange={e => setF({ published_on_site: e.target.checked })} className="rounded" />
          <span className="text-sm">Publicar no site</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer" title="A IA Vendedora pode usar e oferecer este imóvel nas conversas">
          <input type="checkbox" checked={f.ai_enabled ?? true} onChange={e => setF({ ai_enabled: e.target.checked })} className="rounded" />
          <span className="text-sm">Encontrável pela IA</span>
        </label>
      </div>
    </div>
  );
}
