import type { PropsDaSecao } from './tipos';

// Nesta versão: as caixinhas que a janela antiga tinha. Destaque, Publicar no
// site e Encontrável pela IA vão para "Onde divulgar" (B6).
export default function SecaoDetalhesDaVenda({ form: f, setF }: PropsDaSecao) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={f.exclusive} onChange={e => setF({ exclusive: e.target.checked })} className="rounded" />
        <span className="text-sm">Exclusividade</span>
      </label>
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
  );
}
