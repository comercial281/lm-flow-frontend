// Regras puras do ponto no mapa do cadastro (texto, CEP, quando procurar, quando o alfinete pode pular).
import type { PrecisaoDoPonto } from '@/services/properties/propertiesService';

type Origem = 'auto' | 'manual' | null | undefined;

export const TEXTO_DO_PONTO: Record<PrecisaoDoPonto | 'nada' | 'manual', string> = {
  number: 'Achamos pelo endereço. Arraste o alfinete se precisar ajustar.',
  street: 'Não achamos o número exato, mostramos a rua. Arraste até o imóvel.',
  neighborhood: 'Não achamos o endereço. Arraste o alfinete até o imóvel.',
  city: 'Não achamos o endereço. Arraste o alfinete até o imóvel.',
  nada: 'Não achamos o endereço. Arraste o alfinete até o imóvel.',
  manual: 'Posição ajustada à mão.',
};

export function textoDoPonto(precision: PrecisaoDoPonto | null, origem: Origem): string {
  if (origem === 'manual') return TEXTO_DO_PONTO.manual;
  return TEXTO_DO_PONTO[precision ?? 'nada'];
}

/** Os 8 dígitos do CEP, ou null se estiver incompleto. */
export function cepCompleto(cep: string | null | undefined): string | null {
  const digitos = (cep ?? '').replace(/\D/g, '');
  return digitos.length === 8 ? digitos : null;
}

/** Só vale procurar o ponto com cidade e mais alguma pista (rua, CEP completo ou bairro). */
export function podeProcurarPonto(f: {
  address_city?: string | null; address_street?: string | null; address_zip?: string | null; address_neighborhood?: string | null;
}): boolean {
  const tem = (v?: string | null) => !!v?.trim();
  return tem(f.address_city) && (tem(f.address_street) || cepCompleto(f.address_zip) !== null || tem(f.address_neighborhood));
}

/** O alfinete só deixa de pular quando o usuário o arrastou à mão. */
export function alfinetePodePular(origem: Origem): boolean {
  return origem !== 'manual';
}

export const CENTRO_DO_BRASIL: [number, number] = [-14.235, -51.9253];
