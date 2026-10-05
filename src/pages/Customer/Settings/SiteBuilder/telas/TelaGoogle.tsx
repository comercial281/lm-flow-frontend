import { Checkbox, Label as UILabel } from '@/components/ui/ds';
import { getTenantSlug } from '@/services/core/tenant';
import { enderecoNoGoogle } from '@/features/siteBuilder/enderecoDoSite';
import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto, CampoTextoLongo } from '../ui/Campo';
import type { FormProps } from './tipos';

export default function TelaGoogle({ site, siteForm, setF }: FormProps) {
  const ligado = siteForm.google?.indexable === true;
  // A frase diz onde o Google lê o site de verdade: o domínio próprio ativo ou,
  // sem ele, o endereço <cliente>.lmflow.com.br (nunca o app.lmflow.com.br).
  const endereco = site ? enderecoNoGoogle(site, getTenantSlug()) : null;
  const emManutencao = !!site && (!site.active || !site.published);
  const avisoDeManutencao = ligado && emManutencao;
  // O leitor de tela lê, junto com a caixinha, a frase do bloco e onde o Google lê o site.
  const descricoes = ['google-frase', endereco && 'google-endereco', avisoDeManutencao && 'google-manutencao']
    .filter(Boolean).join(' ');

  return (
    <Secoes>
      <Secao
        titulo="Mostrar no Google"
        descricao={<span id="google-frase">Liga quando o site estiver pronto. O Google leva alguns dias pra começar a mostrar.</span>}
      >
        <div className="flex items-center gap-3">
          <Checkbox id="google-aparecer" checked={ligado} aria-describedby={descricoes}
            onCheckedChange={v => setF({ google: { indexable: v === true } })} />
          <UILabel htmlFor="google-aparecer" className="cursor-pointer text-base font-normal">Aparecer no Google</UILabel>
        </div>
        {endereco && (
          <p id="google-endereco" className="pl-7 text-sm text-muted-foreground">
            {site?.domain
              ? <>O Google lê o site pelo seu domínio, <strong>{endereco}</strong>.</>
              : <>O Google lê o site pelo endereço <strong>{endereco}</strong>. Se você ligar um domínio próprio, ele passa a ler pelo domínio.</>}
          </p>
        )}
        {avisoDeManutencao && (
          <p id="google-manutencao" className="pl-7 text-sm text-amber-700 dark:text-amber-400">
            O site está em manutenção: enquanto isso, ele não aparece no Google.
          </p>
        )}
      </Secao>
      <Secao
        titulo="Resultado no Google"
        descricao="O título e a frase que o Google mostra na lista de resultados quando alguém pesquisa a sua imobiliária."
      >
        <CampoTexto id="google-titulo" rotulo="Título" valor={siteForm.seo_title ?? ''}
          placeholder="Imobiliária XYZ — Venda e locação de imóveis"
          ajuda="Também é o nome que aparece na aba do navegador. Use até uns 60 caracteres."
          aoMudar={seo_title => setF({ seo_title })} />
        <CampoTextoLongo id="google-descricao" rotulo="Descrição" valor={siteForm.seo_description ?? ''}
          placeholder="Encontre o imóvel ideal..." rows={2} classeDoControle="resize-none"
          ajuda="A frase embaixo do título nos resultados. Use até uns 160 caracteres. Também vira o subtítulo da capa, se você não escrever outro em Busca rápida."
          aoMudar={seo_description => setF({ seo_description })} />
      </Secao>
    </Secoes>
  );
}
