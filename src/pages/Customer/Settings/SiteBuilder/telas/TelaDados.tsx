import { Input, Label as UILabel } from '@/components/ui/ds';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import type { FormProps } from './tipos';

export default function TelaDados({ siteForm, setF }: FormProps) {
  return (
    <>
      {/* Contact */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">Contato</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'contact_phone', label: 'Telefone', placeholder: '(11) 9999-9999' },
            { key: 'contact_whatsapp', label: 'WhatsApp', placeholder: '5511999999999' },
            { key: 'contact_email', label: 'E-mail', placeholder: 'contato@...' },
          ].map(f => (
            <div key={f.key}>
              <UILabel>{f.label}</UILabel>
              <Input
                value={(siteForm as unknown as Record<string, string>)[f.key] ?? ''}
                onChange={e => setF({ [f.key]: e.target.value } as Partial<SiteFormData>)}
                placeholder={f.placeholder}
                className="mt-1"
              />
            </div>
          ))}
          <div className="col-span-2">
            <UILabel>Endereço</UILabel>
            <Input value={siteForm.contact_address ?? ''} onChange={e => setF({ contact_address: e.target.value })}
              placeholder="Rua..." className="mt-1" />
          </div>
        </div>
      </section>
    </>
  );
}
