import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import { propertiesService, type PropertyFormData } from '@/services/properties/propertiesService';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

export default function SecaoLocalizacao({ form: f, setF }: PropsDaSecao) {
  const [cepLoading, setCepLoading] = useState(false);

  // O CEP preenche só o que achou: o que veio vazio não apaga o que já está no campo.
  const handleCepLookup = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await propertiesService.cepLookup(clean);
      const patch: Partial<PropertyFormData> = {};
      if (data.logradouro) patch.address_street = data.logradouro;
      if (data.bairro) patch.address_neighborhood = data.bairro;
      if (data.localidade) patch.address_city = data.localidade;
      if (data.uf) patch.address_state = data.uf;
      setF(patch);
    } catch {
      // silent — CEP not found is non-fatal
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <UILabel>CEP</UILabel>
        <div className="flex gap-2 mt-1">
          <Input
            value={f.address_zip}
            onChange={e => setF({ address_zip: e.target.value })}
            onBlur={e => handleCepLookup(e.target.value)}
            placeholder="01310-100"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cepLoading}
            onClick={() => handleCepLookup(f.address_zip ?? '')}
            className="shrink-0"
          >
            {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>
      </div>
      <div className="col-span-2">
        <UILabel>Rua</UILabel>
        <Input value={f.address_street} onChange={e => setF({ address_street: e.target.value })}
          placeholder="Av. Paulista" className="mt-1" />
      </div>
      <div>
        <UILabel>Número</UILabel>
        <Input value={f.address_number} onChange={e => setF({ address_number: e.target.value })}
          placeholder="1578" className="mt-1" />
      </div>
      <div>
        <UILabel>Complemento</UILabel>
        <Input value={f.address_complement ?? ''} onChange={e => setF({ address_complement: e.target.value })}
          placeholder="Apto 102" className="mt-1" />
      </div>
      <div>
        <UILabel>Bairro</UILabel>
        <Input value={f.address_neighborhood} onChange={e => setF({ address_neighborhood: e.target.value })}
          placeholder="Bela Vista" className="mt-1" />
      </div>
      <div>
        <UILabel>Cidade</UILabel>
        <Input value={f.address_city} onChange={e => setF({ address_city: e.target.value })}
          placeholder="São Paulo" className="mt-1" />
      </div>
      <div>
        <UILabel>Estado (UF)</UILabel>
        <Input value={f.address_state} onChange={e => setF({ address_state: e.target.value })}
          placeholder="SP" maxLength={2} className="mt-1" />
      </div>
      <div>
        <UILabel className="text-xs text-muted-foreground">Latitude (opcional, p/ mapa)</UILabel>
        <Input type="number" step="any" value={f.latitude ?? ''} onChange={e => setF({ latitude: numeroOuNulo(e.target.value) })}
          placeholder="-23.5505" className="mt-1" />
      </div>
      <div>
        <UILabel className="text-xs text-muted-foreground">Longitude (opcional, p/ mapa)</UILabel>
        <Input type="number" step="any" value={f.longitude ?? ''} onChange={e => setF({ longitude: numeroOuNulo(e.target.value) })}
          placeholder="-46.6333" className="mt-1" />
      </div>
    </div>
  );
}
