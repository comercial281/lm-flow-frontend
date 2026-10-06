import type { LimitesDoPacote } from '@/types/admin/pacotes';

// Validação dos três limites (Contrato do cliente e editor de pacote).
// Só "0" literal é ilimitado: vazio ou inválido nunca vira 0.
const INTEIRO = /^\d+$/;
const DECIMAL = /^\d+([.,]\d+)?$/;

export interface CamposDeLimites { numeros: string; franquia: string; preco: string }
export interface ErrosDeLimites { numeros?: string; franquia?: string; preco?: string }

export function validarLimites({ numeros, franquia, preco }: CamposDeLimites): { erros: ErrosDeLimites; valores?: LimitesDoPacote } {
  const erros: ErrosDeLimites = {};
  if (!INTEIRO.test(numeros.trim())) erros.numeros = 'Digite um número inteiro (0 = ilimitado).';
  if (!(franquia.trim() === '' || INTEIRO.test(franquia.trim()))) erros.franquia = 'Deixe vazio ou digite um número inteiro.';
  if (!DECIMAL.test(preco.trim())) erros.preco = 'Digite um valor, como 2,49.';
  if (erros.numeros || erros.franquia || erros.preco) return { erros };
  return {
    erros,
    valores: {
      max_whatsapp_channels: parseInt(numeros.trim(), 10),
      ai_leads_included: franquia.trim() === '' ? null : parseInt(franquia.trim(), 10),
      ai_lead_overage_price_brl: parseFloat(preco.trim().replace(',', '.')),
    },
  };
}
