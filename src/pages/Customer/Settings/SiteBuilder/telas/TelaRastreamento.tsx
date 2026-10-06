import { Badge } from '@/components/ui/ds';
import { erroGa4, erroGtm, erroPixel } from '@/features/siteBuilder/trackingIds';
import type { TelaId } from '@/features/siteBuilder/meuSiteMenu';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
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
    <p className="text-sm text-muted-foreground">
      Funciona só no seu endereço próprio.{' '}
      <button type="button" className="underline" onClick={() => irPara('endereco')}>
        Configure em Endereço do site.
      </button>
    </p>
  );
}

export default function TelaRastreamento({ site, siteForm, setF, irPara }: Props) {
  // O selo reflete o que está salvo, não o que está sendo digitado.
  const salvo = site?.tracking;
  const eGa4 = erroGa4(siteForm.ga4_measurement_id ?? '');
  const ePixel = erroPixel(siteForm.facebook_pixel_id ?? '');
  const eGtm = erroGtm(siteForm.gtm_id ?? '');

  return (
    <Secoes>
      <Secao
        titulo="Google Analytics"
        descricao="Mostra no Google quantas pessoas visitam o site, de onde vêm e quais páginas mais olham."
        acao={<Selo ligado={!!salvo?.ga4_measurement_id} />}
      >
        <CampoTexto id="rastreio-ga4" rotulo="Código de medição" placeholder="G-AB12CD34EF" classeDoControle="font-mono"
          ajuda="Começa com G-. Onde achar: Analytics › Administrador › Fluxos de dados."
          erro={eGa4 ?? undefined} valor={siteForm.ga4_measurement_id ?? ''}
          aoMudar={v => setF({ ga4_measurement_id: v })} />
      </Secao>

      <Secao
        titulo="Pixel do Meta"
        descricao="Avisa o Meta (Facebook e Instagram) de quem visitou o site, para mostrar anúncios de novo a essas pessoas e contar os contatos que vieram dos anúncios."
        acao={<Selo ligado={!!salvo?.facebook_pixel_id} />}
      >
        <CampoTexto id="rastreio-pixel" rotulo="Número do pixel" placeholder="123456789012345" classeDoControle="font-mono"
          ajuda="Só números. Onde achar: Gerenciador de Eventos › Fontes de dados."
          erro={ePixel ?? undefined} valor={siteForm.facebook_pixel_id ?? ''}
          aoMudar={v => setF({ facebook_pixel_id: v })} />
      </Secao>

      <Secao
        titulo="Google Tag Manager"
        descricao="Só se a sua agência pediu. Serve para ela instalar outras ferramentas de medição sem mexer no site."
        acao={<Selo ligado={!!salvo?.gtm_id} />}
      >
        <CampoTexto id="rastreio-gtm" rotulo="Código do contêiner" placeholder="GTM-AB12CD" classeDoControle="font-mono"
          ajuda="Começa com GTM-." erro={eGtm ?? undefined} valor={siteForm.gtm_id ?? ''}
          aoMudar={v => setF({ gtm_id: v })} />
        <LinhaEnderecoProprio irPara={irPara} />
      </Secao>

      <Secao
        titulo="Códigos avançados"
        descricao="Para colar o código que outra ferramenta pediu para instalar no site. Se ninguém pediu, deixe em branco."
      >
        <details className="group space-y-5">
          <summary className="cursor-pointer text-sm font-medium">Mostrar os campos</summary>
          <div className="mt-5 space-y-5">
            <CampoTextoLongo id="custom-head" rotulo="Código no topo das páginas" rows={5} classeDoControle="font-mono text-xs md:text-xs"
              ajuda="Entra no início do cabeçalho técnico (head) de todas as páginas do site."
              valor={siteForm.custom_head_html ?? ''} aoMudar={v => setF({ custom_head_html: v })} />
            <CampoTextoLongo id="custom-body" rotulo="Código no começo do conteúdo" rows={5} classeDoControle="font-mono text-xs md:text-xs"
              ajuda="Entra logo no começo do corpo (body) de todas as páginas do site."
              valor={siteForm.custom_body_html ?? ''} aoMudar={v => setF({ custom_body_html: v })} />
            <LinhaEnderecoProprio irPara={irPara} />
          </div>
        </details>
      </Secao>
    </Secoes>
  );
}
