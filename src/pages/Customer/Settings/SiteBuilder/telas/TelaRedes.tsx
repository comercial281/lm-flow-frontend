import { useState } from 'react';
import { Input, Label as UILabel } from '@/components/ui/ds';
import { REDES, linkDaRede, type RedeSocial } from '@/features/siteBuilder/socialLinks';
import type { FormProps } from './tipos';

export default function TelaRedes({ siteForm, setF }: FormProps) {
  const links = siteForm.social_links ?? {};
  // Enquanto digita, o campo mostra o que a pessoa escreveu; ao sair, vira link.
  const [rascunho, setRascunho] = useState<Partial<Record<RedeSocial, string>>>({});

  const confirmar = (rede: RedeSocial, valor: string) => {
    const link = linkDaRede(rede, valor);
    const proximo = { ...links };
    if (link) proximo[rede] = link; else delete proximo[rede];
    setRascunho(r => ({ ...r, [rede]: undefined }));
    if ((links[rede] ?? '') !== (link ?? '')) setF({ social_links: proximo });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      {REDES.map(r => (
        <div key={r.id}>
          <UILabel htmlFor={`rede-${r.id}`}>{r.rotulo}</UILabel>
          <Input id={`rede-${r.id}`} value={rascunho[r.id] ?? links[r.id] ?? ''} className="mt-1"
            onChange={e => setRascunho(d => ({ ...d, [r.id]: e.target.value }))}
            onBlur={e => confirmar(r.id, e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{r.exemplo}</p>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Os ícones aparecem no topo e no rodapé do site.</p>
    </section>
  );
}
