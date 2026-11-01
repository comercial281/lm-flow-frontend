import { Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { opcoesDeTipoDeImovel } from '@/services/properties/propertiesService';
import { SITUACOES, rotuloDaSituacao } from '@/features/properties/listingKind';
import { dicaSe, useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import { AVISO_SEM_FINALIDADE, finalidadeDasMarcas, marcasDaFinalidade } from '@/features/properties/cadastro/finalidade';
import { CLASSE_SELETOR, type PropsDaSecao } from './tipos';

export default function SecaoBasico({ form: f, setF }: PropsDaSecao) {
  const kind = f.listing_kind ?? 'resale';
  // Campo que vem do site fica travado (o resto segue livre).
  const tituloTravado = useCampoTravado('title');
  const finalidadeTravada = useCampoTravado('transaction_type');
  const tipoTravado = useCampoTravado('property_type');
  const categoriaTravada = useCampoTravado('category_type');
  const situacaoTravada = useCampoTravado('status');
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2" title={dicaSe(tituloTravado)}>
        <UILabel htmlFor="campo-titulo">{kind === 'development' ? 'Nome do empreendimento' : 'Título'}</UILabel><span aria-hidden="true" className="text-sm"> *</span>
        <Input
          id="campo-titulo"
          value={f.title}
          onChange={e => setF({ title: e.target.value })}
          placeholder="Ex: Apartamento 3 quartos - Jardim Europa"
          disabled={tituloTravado}
          className="mt-1"
        />
      </div>

      {/* Empreendimento e Leilão são sempre venda: o tipo de negócio só aparece na revenda. */}
      {kind === 'resale' && (
        <div className="sm:col-span-2">
          <FinalidadeEmMarcas valor={f.transaction_type} desabilitado={finalidadeTravada}
            aoMudar={v => setF({ transaction_type: v ?? '' })} />
        </div>
      )}

      <div title={dicaSe(tipoTravado || categoriaTravada)}>
        <UILabel>Tipo de imóvel</UILabel>
        <Seletor value={f.property_type} disabled={tipoTravado || categoriaTravada} onChange={e => setF({ property_type: e.target.value })} className={CLASSE_SELETOR}>
          {opcoesDeTipoDeImovel(f.property_type).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Seletor>
      </div>

      <div title={dicaSe(situacaoTravada)}>
        <UILabel>Situação</UILabel>
        <Seletor value={f.status} disabled={situacaoTravada} onChange={e => setF({ status: e.target.value })} className={CLASSE_SELETOR}>
          {SITUACOES[kind].map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          {!SITUACOES[kind].some(s => s.valor === f.status) && (
            <option value={f.status}>{rotuloDaSituacao('resale', f.status)}</option>
          )}
        </Seletor>
      </div>
    </div>
  );
}

/** "À venda" e "Para alugar": uma, outra ou as duas. Nenhuma marcada avisa e o cadastro não salva. */
function FinalidadeEmMarcas({ valor, aoMudar, desabilitado }: {
  valor: string | null | undefined;
  aoMudar: (v: string | null) => void;
  desabilitado: boolean;
}) {
  const marcas = marcasDaFinalidade(valor);
  const trocar = (parte: Partial<typeof marcas>) => aoMudar(finalidadeDasMarcas({ ...marcas, ...parte }, valor));
  return (
    <div title={dicaSe(desabilitado)}>
      <p className="mb-1 block text-sm font-medium">Finalidade</p>
      <div role="group" aria-label="Finalidade" className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={marcas.venda} disabled={desabilitado} onCheckedChange={v => trocar({ venda: v === true })} />
          <span className="text-sm">À venda</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={marcas.aluguel} disabled={desabilitado} onCheckedChange={v => trocar({ aluguel: v === true })} />
          <span className="text-sm">Para alugar</span>
        </label>
      </div>
      {!marcas.venda && !marcas.aluguel && <p role="alert" className="mt-1 text-xs text-destructive">{AVISO_SEM_FINALIDADE}</p>}
    </div>
  );
}
