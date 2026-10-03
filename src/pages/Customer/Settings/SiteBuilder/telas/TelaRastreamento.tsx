import { Badge, Input, Label as UILabel, Textarea } from '@/components/ui/ds';
import { erroGa4, erroGtm, erroPixel } from '@/features/siteBuilder/trackingIds';
import type { TelaId } from '@/features/siteBuilder/meuSiteMenu';
import type { FormProps } from './tipos';

interface Props extends FormProps {
  irPara: (t: TelaId) => void;
}

function Selo({ ligado }: { ligado: boolean }) {
  return ligado
    ? <Badge variant="secondary" className="text-xs">Ligado</Badge>
    : <Badge variant="outline" className="text-xs text-muted-foreground">Não configurado</Badge>;
}

function LinhaEnderecoProprio({ irPara }: { irPara: (t: TelaId) => void }) {
  return (
    <p className="text-xs text-muted-foreground">
      Funciona só no seu endereço próprio.{' '}
      <button type="button" className="underline" onClick={() => irPara('endereco')}>
        Configure em Endereço do site.
      </button>
    </p>
  );
}

function Cartao({ titulo, ligado, children }: { titulo: string; ligado: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <Selo ligado={ligado} />
      </div>
      {children}
    </section>
  );
}

export default function TelaRastreamento({ site, siteForm, setF, irPara }: Props) {
  // O selo reflete o que está salvo, não o que está sendo digitado.
  const salvo = site?.tracking;
  const eGa4 = erroGa4(siteForm.ga4_measurement_id ?? '');
  const ePixel = erroPixel(siteForm.facebook_pixel_id ?? '');
  const eGtm = erroGtm(siteForm.gtm_id ?? '');

  return (
    <div className="space-y-4">
      <Cartao titulo="Google Analytics" ligado={!!salvo?.ga4_measurement_id}>
        <p className="text-sm text-muted-foreground">
          Cole o código que começa com G-. Onde achar: Analytics › Administrador › Fluxos de dados.
        </p>
        <Input value={siteForm.ga4_measurement_id ?? ''} onChange={e => setF({ ga4_measurement_id: e.target.value })}
          placeholder="G-AB12CD34EF" className="font-mono" aria-label="Código de medição" />
        {eGa4 && <p className="text-xs text-destructive">{eGa4}</p>}
      </Cartao>

      <Cartao titulo="Pixel do Meta" ligado={!!salvo?.facebook_pixel_id}>
        <p className="text-sm text-muted-foreground">
          Cole o número do pixel. Onde achar: Gerenciador de Eventos › Fontes de dados.
        </p>
        <Input value={siteForm.facebook_pixel_id ?? ''} onChange={e => setF({ facebook_pixel_id: e.target.value })}
          placeholder="123456789012345" className="font-mono" aria-label="Número do pixel" />
        {ePixel && <p className="text-xs text-destructive">{ePixel}</p>}
      </Cartao>

      <Cartao titulo="Google Tag Manager" ligado={!!salvo?.gtm_id}>
        <p className="text-sm text-muted-foreground">Só se a sua agência pediu. Começa com GTM-.</p>
        <Input value={siteForm.gtm_id ?? ''} onChange={e => setF({ gtm_id: e.target.value })}
          placeholder="GTM-AB12CD" className="font-mono" aria-label="Código do contêiner" />
        {eGtm && <p className="text-xs text-destructive">{eGtm}</p>}
        <LinhaEnderecoProprio irPara={irPara} />
      </Cartao>

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-base font-semibold">Códigos avançados (para quem entende)</summary>
        <div className="mt-4 space-y-3">
          <div>
            <UILabel htmlFor="custom-head">Início do head</UILabel>
            <Textarea id="custom-head" value={siteForm.custom_head_html ?? ''} rows={5}
              onChange={e => setF({ custom_head_html: e.target.value })} className="mt-1 font-mono text-xs" />
          </div>
          <div>
            <UILabel htmlFor="custom-body">Início do body</UILabel>
            <Textarea id="custom-body" value={siteForm.custom_body_html ?? ''} rows={5}
              onChange={e => setF({ custom_body_html: e.target.value })} className="mt-1 font-mono text-xs" />
          </div>
          <LinhaEnderecoProprio irPara={irPara} />
        </div>
      </details>
    </div>
  );
}
