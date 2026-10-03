import type { Construtora } from '@/services/properties/propertiesService';
import { CampoTexto } from './campos';
import type { PropsDaSecao } from './tipos';

const CAMPOS: { rotulo: string; chave: keyof Construtora; tipo?: string }[] = [
  { rotulo: 'Nome da construtora', chave: 'name' },
  { rotulo: 'Pessoa de contato', chave: 'contact_name' },
  { rotulo: 'Telefone', chave: 'phone', tipo: 'tel' },
  { rotulo: 'Site', chave: 'website', tipo: 'url' },
  { rotulo: 'CNPJ', chave: 'cnpj' },
];

// Empreendimento.
export default function SecaoConstrutora({ form: f, setF }: PropsDaSecao) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CAMPOS.map(c => (
        <CampoTexto key={c.chave} rotulo={c.rotulo} type={c.tipo} valor={f.builder?.[c.chave]}
          aoMudar={v => setF({ builder: { ...f.builder, [c.chave]: v } })} />
      ))}
    </div>
  );
}
