import { Button, Label as UILabel } from '@/components/ui/ds';
import DomainSettings from '../DomainSettings';
import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto } from '../ui/Campo';
import type { FormProps } from './tipos';

interface Props extends FormProps {
  // Sem site ainda, esta tela é onde ele nasce: o botão Criar site faz o papel
  // da BarraSalvar (mesmo handleSaveSite do pai).
  aoCriar: () => void;
  salvando: boolean;
}

export default function TelaEndereco({ site, siteForm, setF, aoCriar, salvando }: Props) {
  return (
    <div className="space-y-6">
      <Secoes>
        <Secao titulo="Nome e endereço" descricao="O nome da imobiliária aparece no topo do site quando não há logo, no rodapé e na aba do navegador.">
          <div className="grid gap-5 md:grid-cols-2">
            <CampoTexto id="endereco-nome" rotulo="Nome do site *" valor={siteForm.name} placeholder="Imobiliária XYZ"
              ajuda="Use o nome que o cliente conhece." aoMudar={name => setF({ name })} />
            <CampoTexto id="endereco-final" rotulo="Endereço do site (URL)" valor={siteForm.slug ?? ''} placeholder="imobiliaria-xyz"
              classeDoControle="font-mono" ajuda="O final do endereço, sem espaço nem acento."
              aoMudar={slug => setF({ slug })} />
          </div>
        </Secao>

        <Secao titulo="No ar" descricao="Com as duas marcadas, o painel mostra o selo No ar ao lado do endereço do site.">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="active" checked={siteForm.active}
                onChange={e => setF({ active: e.target.checked })} className="h-4 w-4 rounded" />
              <UILabel htmlFor="active" className="cursor-pointer text-base font-normal">Ativo</UILabel>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="published" checked={siteForm.published}
                onChange={e => setF({ published: e.target.checked })} className="h-4 w-4 rounded" />
              <UILabel htmlFor="published" className="cursor-pointer text-base font-normal">Publicado</UILabel>
            </div>
          </div>
        </Secao>
      </Secoes>

      {/* Domínio próprio — conectado direto na Vercel, sem ninguém entrar lá na mão */}
      {site && <DomainSettings siteId={site.id} />}

      {!site && (
        <div className="flex justify-end">
          <Button onClick={aoCriar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Criar site'}
          </Button>
        </div>
      )}
    </div>
  );
}
