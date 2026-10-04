import { Checkbox, Label as UILabel } from '@/components/ui/ds';
import {
  CAMPOS_BUSCA, HOME_FABRICA, TITULO_CAPA_FABRICA, type AbaId, type CampoBusca, type HomeConfig,
} from '@/features/siteBuilder/public/homeConfig';
import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto } from '../ui/Campo';
import type { FormProps } from './tipos';

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'sale', rotulo: 'Comprar' },
  { id: 'rent', rotulo: 'Alugar' },
  { id: 'launch', rotulo: 'Lançamentos' },
];

const ROTULO_CAMPO: Record<CampoBusca, string> = {
  type: 'Tipo', city: 'Cidade', neighborhood: 'Bairro', price: 'Faixa de preço', bedrooms: 'Dormitórios',
  suites: 'Suítes', parking: 'Vagas', stage: 'Fase da obra', code: 'Código',
};

export default function TelaBusca({ siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const { search } = home;
  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const mudar = (parte: Partial<HomeConfig['search']>) => setF({ home: { ...home, search: { ...search, ...parte } } });

  const alternarCampo = (campo: CampoBusca, marcado: boolean) =>
    mudar({ fields: CAMPOS_BUSCA.filter(c => (c === campo ? marcado : search.fields.includes(c))) });

  return (
    <Secoes>
      <Secao titulo="Capa" descricao="O texto grande no topo da página inicial, logo acima da busca.">
        <CampoTexto id="busca-titulo" rotulo="Título" valor={search.title ?? ''} placeholder={TITULO_CAPA_FABRICA}
          ajuda="Em branco, o site usa o texto que aparece de exemplo no campo."
          aoMudar={v => mudar({ title: v || null })} />
        <CampoTexto id="busca-subtitulo" rotulo="Subtítulo" valor={search.subtitle ?? ''}
          placeholder="Usa a descrição de Aparecer no Google"
          ajuda="A frase menor, embaixo do título. Em branco, o site usa a descrição de Aparecer no Google."
          aoMudar={v => mudar({ subtitle: v || null })} />
      </Secao>

      <Secao titulo="Abas" descricao="O que o visitante escolhe antes de buscar. Aba sem imóvel some sozinha do site.">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {ABAS.map(a => (
            <div key={a.id} className="flex items-center gap-3">
              <Checkbox id={`aba-${a.id}`} checked={search.tabs[a.id]}
                onCheckedChange={v => mudar({ tabs: { ...search.tabs, [a.id]: v === true } })} />
              <UILabel htmlFor={`aba-${a.id}`} className="cursor-pointer text-base font-normal">{a.rotulo}</UILabel>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Filtros da capa"
        descricao="Os campos da busca da página inicial. Na página de busca o visitante tem todos os filtros."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CAMPOS_BUSCA.map(c => (
            <div key={c} className="flex items-center gap-3">
              <Checkbox id={`campo-${c}`} checked={search.fields.includes(c)}
                onCheckedChange={v => alternarCampo(c, v === true)} />
              <UILabel htmlFor={`campo-${c}`} className="cursor-pointer text-base font-normal">{ROTULO_CAMPO[c]}</UILabel>
            </div>
          ))}
        </div>
      </Secao>
    </Secoes>
  );
}
