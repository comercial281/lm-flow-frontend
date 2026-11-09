import { Link } from 'react-router-dom';
import { Checkbox, Label as UILabel } from '@/components/ui/ds';
import { getTenantSlug } from '@/services/core/tenant';
import { enderecoNoGoogle } from '@/features/siteBuilder/enderecoDoSite';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import { lerContas, naoReconhecido, resolverGoogle } from '@/features/siteBuilder/contasDoGoogle';
import type { SiteGoogle } from '@/services/siteBuilder/siteBuilderService';
import type { FormProps } from './tipos';

export default function TelaGoogle({ site, siteForm, setF }: FormProps) {
  const google = resolverGoogle(siteForm.google);
  const ligado = google.indexable;
  // O bloco viaja inteiro: mudar um campo nunca apaga os outros.
  const mudar = (parcial: Partial<SiteGoogle>) => setF({ google: { ...google, ...parcial } });
  const erro = (valor: string | null | undefined, ler: (v: string) => string | null, msg: string) =>
    naoReconhecido(valor, ler) ? msg : undefined;
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
            onCheckedChange={v => mudar({ indexable: v === true })} />
          <UILabel htmlFor="google-aparecer" className="cursor-pointer text-base font-normal">Aparecer no Google</UILabel>
        </div>
        {endereco && (
          <p id="google-endereco" className="break-words pl-7 text-sm text-muted-foreground">
            {site?.domain
              ? <>O Google lê o site pelo seu domínio, <strong className="break-all">{endereco}</strong>.</>
              : <>O Google lê o site pelo endereço <strong className="break-all">{endereco}</strong>. Se você ligar um domínio próprio, ele passa a ler pelo domínio.</>}
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
      <Secao
        titulo="Contas da imobiliária no Google"
        descricao="Tudo aqui é da conta da imobiliária, não da agência. Cada campo é opcional: preencha o que já tiver."
      >
        <CampoTexto id="google-search-console" rotulo="Search Console (verificação do site)" classeDoControle="font-mono"
          placeholder='<meta name="google-site-verification" content="..." />'
          valor={google.search_console ?? ''}
          ajuda={<>Prova pro Google que o site é seu e libera os relatórios de busca. Onde achar: search.google.com/search-console › Adicionar propriedade › <strong>Prefixo do URL</strong> (o endereço do site) › Outros métodos de verificação › <strong>Tag HTML</strong> › Copiar. Cole aqui o código inteiro, salve o site e só depois clique em Verificar no Search Console.</>}
          erro={erro(google.search_console, lerContas.searchConsole, 'Não reconheci esse código. Cole a tag que começa com <meta name="google-site-verification" ou só o código dentro de content.')}
          aoMudar={search_console => mudar({ search_console })} />
        <CampoTexto id="google-bing" rotulo="Bing (verificação do site)" classeDoControle="font-mono"
          placeholder='<meta name="msvalidate.01" content="..." />'
          valor={google.bing ?? ''}
          ajuda="O Bing também alimenta o ChatGPT e o Copilot. Onde achar: bing.com/webmasters › Adicionar site › Meta tag HTML. Se o site já está no Search Console, dá pra importar de lá e deixar este campo em branco."
          erro={erro(google.bing, lerContas.bing, 'Não reconheci esse código. Cole a tag que começa com <meta name="msvalidate.01" ou só o código dentro de content.')}
          aoMudar={bing => mudar({ bing })} />
        <CampoTexto id="google-perfil" rotulo="Perfil da Empresa no Google" placeholder="https://g.page/sua-imobiliaria"
          valor={google.business_profile_url ?? ''}
          ajuda="Liga o site à ficha da imobiliária no Google Maps. Onde achar: pesquise a imobiliária no Google › no seu perfil, Compartilhar › Copiar link."
          erro={erro(google.business_profile_url, lerContas.perfil, 'Cole o link inteiro, começando com https://.')}
          aoMudar={business_profile_url => mudar({ business_profile_url })} />
        {/* O CRECI saiu daqui (11/2026): mora na Conta e aparece no rodapé e em
            cada imóvel. O gravado no bloco segue viajando inteiro (mudar()) e
            vale como reserva enquanto a Conta estiver vazia. */}
        <p className="text-sm text-muted-foreground">
          O CRECI agora fica em{' '}
          <Link to="/settings/account" className="font-medium text-primary underline-offset-2 hover:underline">Configurações › Conta</Link>.
        </p>
        <p className="text-sm text-muted-foreground">Google Analytics, Pixel do Meta, Tag Manager e Clarity ficam em Rastreamento.</p>
      </Secao>
    </Secoes>
  );
}
