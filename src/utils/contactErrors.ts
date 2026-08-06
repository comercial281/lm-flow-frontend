import { apiErrorMessage } from '@/utils/apiHelpers';

/**
 * Contato que já ocupa o telefone/e-mail que se tentou cadastrar. Só vem quando
 * o backend julga que quem cadastrou pode enxergá-lo — corretor isolado não
 * recebe o nome do lead de outro corretor.
 */
export interface DuplicateContact {
  id: string;
  name?: string;
  phone_number?: string;
  email?: string;
}

export interface ContactSaveError {
  /** Mensagem pronta pra toast, em português. */
  message: string;
  /** true quando o cadastro bateu na unicidade de telefone/e-mail. */
  duplicate: boolean;
  /** Contato existente, quando o backend pôde identificá-lo. */
  existing?: DuplicateContact;
}

interface ApiErrorShape {
  response?: {
    data?: {
      error?: {
        code?: string;
        message?: string;
        details?: {
          field?: string;
          duplicate?: boolean;
          visible?: boolean;
          contact?: DuplicateContact;
        };
      };
      message?: string;
    };
  };
}

const DUPLICATE_CODES = ['DUPLICATE_PHONE', 'DUPLICATE_EMAIL', 'DUPLICATE_IDENTIFIER', 'RESOURCE_ALREADY_EXISTS'];

const FIELD_LABEL: Record<string, string> = {
  phone_number: 'telefone',
  email: 'e-mail',
  identifier: 'identificador',
  tax_id: 'CPF/CNPJ',
};

/**
 * Traduz a falha de POST/PATCH /contacts para algo acionável.
 *
 * Existe por causa do cadastro de cliente de carteira: a pessoa quase sempre já
 * está na base (agenda do aparelho, conversa antiga) mas não aparece na aba, que
 * é recorte de lead. O corretor cadastrava de novo, batia na unicidade e via só
 * "Erro ao criar contato" — sem saber que o contato existe nem como chegar nele.
 *
 * @param error - erro capturado (axios)
 * @param fallback - mensagem padrão quando não é duplicidade e o backend não diz nada
 */
export function contactSaveError(error: unknown, fallback: string): ContactSaveError {
  const e = error as ApiErrorShape;
  const apiError = e?.response?.data?.error;
  const details = apiError?.details;

  const isDuplicate = Boolean(details?.duplicate) || DUPLICATE_CODES.includes(apiError?.code ?? '');
  if (!isDuplicate) {
    return { message: apiErrorMessage(error, fallback), duplicate: false };
  }

  const field = FIELD_LABEL[details?.field ?? ''] || 'dado';
  const existing = details?.contact;

  if (existing?.id) {
    const who = existing.name?.trim();
    return {
      message: who
        ? `Já existe um contato com esse ${field}: ${who}.`
        : `Já existe um contato com esse ${field}.`,
      duplicate: true,
      existing,
    };
  }

  // Sem identificação: ou o backend não achou o registro, ou ele é de outro
  // corretor. Dizer "já existe" mesmo assim evita o corretor tentar de novo.
  return {
    message: `Já existe um contato com esse ${field}, cadastrado por outra pessoa da equipe.`,
    duplicate: true,
  };
}
