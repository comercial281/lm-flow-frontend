import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto, CampoTextoLongo } from '../ui/Campo';
import type { FormProps } from './tipos';

export default function TelaGoogle({ siteForm, setF }: FormProps) {
  return (
    <Secoes>
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
