import { Input, Label as UILabel } from '@/components/ui/ds';
import { REDES, linkDaRede, type RedeSocial } from '@/features/siteBuilder/socialLinks';
import type { FormProps } from './tipos';

export default function TelaRedes({ siteForm, setF }: FormProps) {
  const links = siteForm.social_links ?? {};

  // Enquanto digita, o valor cru já vai pro formulário (a barra de Salvar
  // aparece na hora); ao sair do campo, vira link.
  const digitar = (rede: RedeSocial, valor: string) => setF({ social_links: { ...links, [rede]: valor } });

  const confirmar = (rede: RedeSocial, valor: string) => {
    const link = linkDaRede(rede, valor) ?? undefined;
    if (links[rede] === link) return;
    const proximo = { ...links };
    if (link) proximo[rede] = link; else delete proximo[rede];
    setF({ social_links: proximo });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      {REDES.map(r => (
        <div key={r.id}>
          <UILabel htmlFor={`rede-${r.id}`}>{r.rotulo}</UILabel>
          <Input id={`rede-${r.id}`} value={links[r.id] ?? ''} className="mt-1"
            onChange={e => digitar(r.id, e.target.value)}
            onBlur={e => confirmar(r.id, e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{r.exemplo}</p>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Os ícones aparecem no topo e no rodapé do site.</p>
    </section>
  );
}
