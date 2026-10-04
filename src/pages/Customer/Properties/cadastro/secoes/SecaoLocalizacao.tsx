// Localização do cadastro: o CEP preenche o endereço, o endereço acha o ponto
// no servidor e o alfinete no mapa pode ser arrastado até o imóvel.
// Alfinete arrastado à mão não pula mais sozinho: só pelo "Reposicionar pelo endereço".
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import {
  propertiesService,
  type PontoAchado,
  type PrecisaoDoPonto,
  type PropertyFormData,
} from '@/services/properties/propertiesService';
import {
  CENTRO_DO_BRASIL,
  TEXTO_DO_PONTO,
  alfinetePodePular,
  cepCompleto,
  podeProcurarPonto,
  textoDoPonto,
} from '@/features/properties/localizacao';
import type { PropsDaSecao } from './tipos';

// O Leaflet só baixa quando o mapa aparece.
const MapaDoCadastro = lazy(() => import('./MapaDoCadastro'));

const ZOOM_DA_PRECISAO: Record<PrecisaoDoPonto, number> = { number: 17, street: 16, neighborhood: 14, city: 12 };
const ZOOM_SEM_PRECISAO = 12;
const ZOOM_DO_BRASIL = 4;
// Serviço de mapa ocupado: tenta de novo uma vez, em silêncio.
const ESPERA_PARA_TENTAR_DE_NOVO_MS = 1500;

const texto = (v?: string | null) => v?.trim() || undefined;
const origemDo = (f: Pick<PropertyFormData, 'location_source'>) => f.location_source || null;

// O que conta como "o endereço mudou" depois que o alfinete foi posto à mão.
const chaveDoEndereco = (f: PropertyFormData) =>
  [f.address_street, f.address_number, f.address_neighborhood, f.address_city, f.address_state]
    .map(v => (v ?? '').trim().toLowerCase()).join('|');
// O que já foi procurado (sair do campo sem mudar nada não procura de novo).
const chaveDaBusca = (f: PropertyFormData) => `${chaveDoEndereco(f)}|${cepCompleto(f.address_zip) ?? ''}`;

/** O ponto do endereço; null quando o serviço falhou duas vezes (conta como não achado). */
async function procurarNoServidor(f: PropertyFormData): Promise<PontoAchado | null> {
  const params = {
    street: texto(f.address_street), number: texto(f.address_number), neighborhood: texto(f.address_neighborhood),
    city: texto(f.address_city), state: texto(f.address_state), cep: cepCompleto(f.address_zip) ?? undefined,
  };
  try {
    const r = await propertiesService.geocode(params);
    if (!r.failed) return r;
    await new Promise(fim => setTimeout(fim, ESPERA_PARA_TENTAR_DE_NOVO_MS));
    const r2 = await propertiesService.geocode(params);
    return r2.failed ? null : r2;
  } catch {
    return null;
  }
}

export default function SecaoLocalizacao({ form: f, setF }: PropsDaSecao) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepNaoAchado, setCepNaoAchado] = useState(false);
  const cepEmBusca = useRef<string | null>(null);
  // Precisão do último ponto procurado nesta tela; undefined = nada procurado
  // ainda (o ponto, se houver, veio salvo).
  const [precisao, setPrecisao] = useState<PrecisaoDoPonto | null | undefined>(undefined);
  const [centroDaCidade, setCentroDaCidade] = useState<[number, number] | null>(null);

  const ponto: [number, number] | null = f.latitude != null && f.longitude != null ? [f.latitude, f.longitude] : null;
  const ultimaBusca = useRef<string | null>(ponto ? chaveDaBusca(f) : null);
  // Cada busca tem a sua vez: resposta atrasada (ou depois de sair da tela) não grava.
  const vez = useRef(0);
  useEffect(() => () => { vez.current += 1; }, []);

  // Endereço de quando o alfinete foi posto à mão (agora ou já salvo assim).
  const manual = origemDo(f) === 'manual';
  const [enderecoDoAlfinete, setEnderecoDoAlfinete] = useState<string | null>(manual ? chaveDoEndereco(f) : null);
  if (manual && enderecoDoAlfinete === null) setEnderecoDoAlfinete(chaveDoEndereco(f));
  if (!manual && enderecoDoAlfinete !== null) setEnderecoDoAlfinete(null);

  const centrarNaCidade = async (alvo: PropertyFormData, minha: number) => {
    try {
      const r = await propertiesService.geocode({ city: texto(alvo.address_city), state: texto(alvo.address_state) });
      if (minha === vez.current && !r.failed && r.lat != null && r.lng != null) setCentroDaCidade([r.lat, r.lng]);
    } catch {
      // fica o centro do Brasil
    }
  };

  const procurarPonto = async (alvo: PropertyFormData, { reposicionar = false } = {}) => {
    if (!podeProcurarPonto(alvo)) return;
    if (!reposicionar && !alfinetePodePular(origemDo(alvo))) return;
    const chave = chaveDaBusca(alvo);
    if (!reposicionar && chave === ultimaBusca.current) return;
    ultimaBusca.current = chave;
    const minha = ++vez.current;
    const r = await procurarNoServidor(alvo);
    if (minha !== vez.current) return;
    if (r && r.lat != null && r.lng != null) {
      const { lat, lng } = r;
      setPrecisao(r.precision);
      // Arrastou enquanto procurava: o alfinete da pessoa fica.
      setF(prev => (reposicionar || alfinetePodePular(origemDo(prev))
        ? { latitude: lat, longitude: lng, location_source: 'auto' }
        : {}));
      return;
    }
    // Serviço fora: sair do campo de novo tenta outra vez.
    if (!r) ultimaBusca.current = null;
    setPrecisao(null);
    // Sem ponto nenhum: o mapa abre na cidade (só para olhar, não grava).
    if (alvo.latitude == null || alvo.longitude == null) void centrarNaCidade(alvo, minha);
  };

  // O CEP preenche só o que achou: o que veio vazio não apaga o que já está no campo.
  const buscarCep = async (valor: string) => {
    const cep = cepCompleto(valor);
    if (!cep || cepEmBusca.current === cep) return;
    cepEmBusca.current = cep;
    setCepLoading(true);
    try {
      const data = await propertiesService.cepLookup(cep);
      const patch: Partial<PropertyFormData> = {};
      if (data.address_street) patch.address_street = data.address_street;
      if (data.address_neighborhood) patch.address_neighborhood = data.address_neighborhood;
      if (data.address_city) patch.address_city = data.address_city;
      if (data.address_state) patch.address_state = data.address_state;
      if (Object.keys(patch).length) {
        setF(patch);
        void procurarPonto({ ...f, ...patch, address_zip: valor });
      }
    } catch (e) {
      // Só o "não existe" avisa; outra falha não atrapalha quem digita o endereço à mão.
      if ((e as { response?: { status?: number } })?.response?.status === 404) setCepNaoAchado(true);
    } finally {
      cepEmBusca.current = null;
      setCepLoading(false);
    }
  };

  const aoSairDoEndereco = () => { void procurarPonto(f); };
  const arrastar = (latitude: number, longitude: number) => setF({ latitude, longitude, location_source: 'manual' });

  const mostraMapa = !!ponto || podeProcurarPonto(f);
  const podeReposicionar = manual && enderecoDoAlfinete !== null && enderecoDoAlfinete !== chaveDoEndereco(f) && podeProcurarPonto(f);
  const centro = ponto ?? centroDaCidade ?? CENTRO_DO_BRASIL;
  const zoom = ponto
    ? (precisao ? ZOOM_DA_PRECISAO[precisao] : ZOOM_SEM_PRECISAO)
    : (centroDaCidade ? ZOOM_DA_PRECISAO.city : ZOOM_DO_BRASIL);
  // Sem busca nesta tela, o aviso vem da origem do ponto salvo; ponto antigo digitado não tem aviso.
  const aviso = precisao !== undefined ? textoDoPonto(precisao, origemDo(f))
    : ponto && origemDo(f) === 'auto' ? TEXTO_DO_PONTO.number
      : ponto && manual ? TEXTO_DO_PONTO.manual
        : null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <UILabel htmlFor="campo-cep">CEP</UILabel>
        <div className="flex gap-2 mt-1">
          <Input
            id="campo-cep"
            value={f.address_zip}
            onChange={e => { setCepNaoAchado(false); setF({ address_zip: e.target.value }); }}
            onBlur={e => buscarCep(e.target.value)}
            placeholder="01310-100"
            className="flex-1"
            aria-invalid={cepNaoAchado || undefined}
            aria-describedby={cepNaoAchado ? 'campo-cep-erro' : undefined}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cepLoading}
            onClick={() => buscarCep(f.address_zip ?? '')}
            className="shrink-0"
          >
            {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>
        {cepNaoAchado && <p id="campo-cep-erro" className="mt-1 text-xs text-destructive">CEP não encontrado</p>}
      </div>
      <div className="col-span-2">
        <UILabel htmlFor="campo-rua">Rua</UILabel>
        <Input id="campo-rua" value={f.address_street} onChange={e => setF({ address_street: e.target.value })}
          onBlur={aoSairDoEndereco} placeholder="Av. Paulista" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-numero">Número</UILabel>
        <Input id="campo-numero" value={f.address_number} onChange={e => setF({ address_number: e.target.value })}
          onBlur={aoSairDoEndereco} placeholder="1578" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-complemento">Complemento</UILabel>
        <Input id="campo-complemento" value={f.address_complement ?? ''} onChange={e => setF({ address_complement: e.target.value })}
          placeholder="Apto 102" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-bairro">Bairro</UILabel>
        <Input id="campo-bairro" value={f.address_neighborhood} onChange={e => setF({ address_neighborhood: e.target.value })}
          placeholder="Bela Vista" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-cidade">Cidade</UILabel>
        <Input id="campo-cidade" value={f.address_city} onChange={e => setF({ address_city: e.target.value })}
          onBlur={aoSairDoEndereco} placeholder="São Paulo" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-uf">Estado (UF)</UILabel>
        <Input id="campo-uf" value={f.address_state} onChange={e => setF({ address_state: e.target.value })}
          onBlur={aoSairDoEndereco} placeholder="SP" maxLength={2} className="mt-1" />
      </div>

      <div className="col-span-2 space-y-2">
        {mostraMapa ? (
          <>
            <Suspense fallback={<div className="h-[240px] animate-pulse rounded-xl border bg-muted/40" />}>
              <MapaDoCadastro lat={centro[0]} lng={centro[1]} zoom={zoom} aoArrastar={arrastar} />
            </Suspense>
            {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
            {podeReposicionar && (
              <Button type="button" variant="outline" size="sm" onClick={() => { void procurarPonto(f, { reposicionar: true }); }}>
                Reposicionar pelo endereço
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Preencha o endereço para marcar o imóvel no mapa.</p>
        )}
        {f.listing_kind !== 'development' && (
          <p className="text-xs text-muted-foreground">No site e nos portais aparece só a região, não o endereço exato.</p>
        )}
      </div>
    </div>
  );
}
