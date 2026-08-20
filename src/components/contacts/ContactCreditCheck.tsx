import { useState } from 'react';
import { Button } from '@/components/ui/ds';
import { ShieldCheck, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { contactsService } from '@/services/contacts/contactsService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { Contact, CreditCheckResult } from '@/types/contacts';
import CreditCheckBadge from './CreditCheckBadge';

interface ContactCreditCheckProps {
  contact: Contact;
  onUpdated?: () => void;
}

function resolveCpf(contact: Contact): string | null {
  return (
    contact.tax_id ||
    (contact.additional_attributes as Record<string, unknown>)?.cpf as string ||
    (contact.custom_attributes as Record<string, unknown>)?.cpf as string ||
    null
  );
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
}

export default function ContactCreditCheck({ contact, onUpdated }: ContactCreditCheckProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreditCheckResult | null>(
    contact.additional_attributes?.credit_check ?? null,
  );

  const cpf = resolveCpf(contact);
  const hasCpf = Boolean(cpf);

  const handleCheck = async () => {
    if (!hasCpf) {
      toast.error('Contato sem CPF cadastrado.');
      return;
    }
    setLoading(true);
    try {
      const data = await contactsService.checkContactCredit(contact.id);
      setResult(data.credit_check);
      toast.success('Consulta de CPF concluída.');
      onUpdated?.();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao consultar CPF.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          Consulta de CPF
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={loading || !hasCpf}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : result ? (
            <RefreshCw className="h-4 w-4 mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          {result ? 'Consultar de novo' : 'Consultar CPF'}
        </Button>
      </div>

      {!hasCpf && (
        <p className="text-xs text-muted-foreground">
          Cadastre o CPF do contato (campo CPF/tax_id) para liberar a consulta.
        </p>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CreditCheckBadge status={result.status} score={result.score} />
          </div>
          <p className="text-sm">{result.summary}</p>
          {result.checked_at && (
            <p className="text-xs text-muted-foreground">
              Consultado em {formatDateTime(result.checked_at)}
              {result.datasets?.length ? ` · ${result.datasets.join(', ')}` : ''}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Informação de apoio. A decisão de aprovação é sempre humana.
          </p>
        </div>
      )}
    </div>
  );
}
