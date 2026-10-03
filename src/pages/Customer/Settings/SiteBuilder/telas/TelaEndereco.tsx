import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import DomainSettings from '../DomainSettings';
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
      {/* Basic */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">Informações básicas</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <UILabel>Nome do site *</UILabel>
            <Input value={siteForm.name} onChange={e => setF({ name: e.target.value })}
              placeholder="Imobiliária XYZ" className="mt-1" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <UILabel>Endereço do site (URL)</UILabel>
            <Input value={siteForm.slug} onChange={e => setF({ slug: e.target.value })}
              placeholder="imobiliaria-xyz" className="mt-1 font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active" checked={siteForm.active}
              onChange={e => setF({ active: e.target.checked })} className="rounded" />
            <UILabel htmlFor="active" className="cursor-pointer">Ativo</UILabel>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="published" checked={siteForm.published}
              onChange={e => setF({ published: e.target.checked })} className="rounded" />
            <UILabel htmlFor="published" className="cursor-pointer">Publicado</UILabel>
          </div>
        </div>
      </section>

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
