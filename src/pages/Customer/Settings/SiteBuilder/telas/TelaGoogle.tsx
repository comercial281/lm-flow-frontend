import { Input, Label as UILabel, Textarea } from '@/components/ui/ds';
import type { FormProps } from './tipos';

export default function TelaGoogle({ siteForm, setF }: FormProps) {
  return (
    <>
      {/* SEO */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">SEO</h2>
        <div className="space-y-3">
          <div>
            <UILabel>Título SEO</UILabel>
            <Input value={siteForm.seo_title ?? ''} onChange={e => setF({ seo_title: e.target.value })}
              placeholder="Imobiliária XYZ — Venda e locação de imóveis" className="mt-1" />
          </div>
          <div>
            <UILabel>Meta description</UILabel>
            <Textarea value={siteForm.seo_description ?? ''} onChange={e => setF({ seo_description: e.target.value })}
              placeholder="Encontre o imóvel ideal..." rows={2} className="mt-1 resize-none" />
          </div>
        </div>
      </section>
    </>
  );
}
