import { Button, Checkbox, Label as UILabel } from '@/components/ui/ds';
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
        <Secao titulo="Nome e endereço" descricao="O nome da imobiliária aparece no topo do site quando não há logo e no rodapé. Também vai na aba do navegador, se você não escrever um título em Aparecer no Google.">
          <div className="grid gap-5 md:grid-cols-2">
            <CampoTexto id="endereco-nome" rotulo="Nome do site *" valor={siteForm.name} placeholder="Imobiliária XYZ"
              ajuda="Use o nome que o cliente conhece." aoMudar={name => setF({ name })} />
            <CampoTexto id="endereco-final" rotulo="Endereço do site (URL)" valor={siteForm.slug ?? ''} placeholder="imobiliaria-xyz"
              classeDoControle="font-mono" ajuda="O final do endereço, sem espaço nem acento."
              aoMudar={slug => setF({ slug })} />
          </div>
        </Secao>

        <Secao titulo="No ar" descricao="Com as duas marcadas, o site fica aberto pra todo mundo. Desmarcando qualquer uma, o site mostra a página Em manutenção; a página de um imóvel aberta por link continua funcionando.">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <Checkbox id="active" checked={siteForm.active}
                onCheckedChange={v => setF({ active: v === true })} />
              <UILabel htmlFor="active" className="cursor-pointer text-base font-normal">Ativo</UILabel>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="published" checked={siteForm.published}
                onCheckedChange={v => setF({ published: v === true })} />
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
