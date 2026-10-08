// "Sobre o negócio" (spec do funil §5.3) — só na página do card. Preço estimado
// e data de fechamento esperada, editados na hora, sem botão Salvar, como o
// resto do card. O preço estimado é o valor que vai para a Meta quando o lead é
// marcado Ganho (§3.4). Depois viram filtro do funil (decisão 14).
import { useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import { dinheiro, numero } from '@/lib/formato';
import { formatDateBR } from '@/utils/dateUtils';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineItem } from '@/types/analytics';
import { digitosDoPreco, precoParaEnviar } from '../sobreONegocio';
import CaixaDoCard from './CaixaDoCard';

export type CamposDoNegocio = Partial<Pick<PipelineItem, 'estimated_value' | 'expected_close_on'>>;

interface BlocoSobreONegocioProps {
  pipelineId: string;
  itemId: string;
  preco: string | null | undefined;
  data: string | null | undefined;
  /** Só os campos que mudaram (o PATCH responde sem a conversa: não troque o card todo). */
  aoSalvar: (campos: CamposDoNegocio) => void;
}

const Salvando = () => <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Salvando" />;

export default function BlocoSobreONegocio({ pipelineId, itemId, preco, data, aoSalvar }: BlocoSobreONegocioProps) {
  const [editandoPreco, setEditandoPreco] = useState(false);
  const [digitos, setDigitos] = useState('');
  const [editandoData, setEditandoData] = useState(false);
  const [salvando, setSalvando] = useState<'preco' | 'data' | null>(null);
  // Esc: o blur que vem junto não grava.
  const desistiu = useRef(false);

  const abrirPreco = () => {
    setDigitos(digitosDoPreco(preco));
    setEditandoPreco(true);
  };

  const salvarPreco = async () => {
    setEditandoPreco(false);
    if (desistiu.current) {
      desistiu.current = false;
      return;
    }
    const novo = precoParaEnviar(digitos);
    if (novo === precoParaEnviar(digitosDoPreco(preco))) return;
    setSalvando('preco');
    try {
      const salvo = await pipelinesService.updateItemBusiness(pipelineId, itemId, { estimated_value: novo });
      aoSalvar({ estimated_value: salvo?.estimated_value ?? (novo == null ? null : String(novo)) });
    } catch {
      toast.error('Não consegui salvar o preço estimado.');
    } finally {
      setSalvando(null);
    }
  };

  const salvarData = async (valor: string | null) => {
    setEditandoData(false);
    if (valor === (data ?? null)) return;
    setSalvando('data');
    try {
      const salvo = await pipelinesService.updateItemBusiness(pipelineId, itemId, { expected_close_on: valor });
      aoSalvar({ expected_close_on: salvo?.expected_close_on ?? valor });
    } catch {
      toast.error('Não consegui salvar a data de fechamento.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <CaixaDoCard titulo="Sobre o negócio">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Preço estimado</dt>
          <dd className="flex items-center gap-1.5">
            {editandoPreco ? (
              <span className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  aria-label="Preço estimado"
                  inputMode="numeric"
                  autoFocus
                  className="h-8 w-36"
                  placeholder="450.000"
                  value={digitos ? numero(Number(digitos)) : ''}
                  onChange={e => setDigitos(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => void salvarPreco()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      desistiu.current = true;
                      setEditandoPreco(false);
                    }
                  }}
                />
              </span>
            ) : (
              <button type="button" onClick={abrirPreco} className="text-left text-sm font-medium hover:text-primary">
                {preco ? dinheiro(preco, { centavos: false }) : <span className="font-normal text-muted-foreground">Adicionar preço</span>}
              </button>
            )}
            {salvando === 'preco' && <Salvando />}
          </dd>
        </div>

        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Data de fechamento esperada</dt>
          <dd className="flex items-center gap-1.5">
            {editandoData ? (
              // type="date" só dispara onChange com a data completa: gravar na hora é seguro.
              <Input
                type="date"
                aria-label="Data de fechamento esperada"
                autoFocus
                className="h-8 w-44"
                defaultValue={data ?? ''}
                onChange={e => { if (e.target.value) void salvarData(e.target.value); }}
                onBlur={() => setEditandoData(false)}
              />
            ) : (
              <button type="button" onClick={() => setEditandoData(true)} className="text-left text-sm font-medium hover:text-primary">
                {data ? formatDateBR(data) : <span className="font-normal text-muted-foreground">Adicionar data</span>}
              </button>
            )}
            {data && !editandoData && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="Limpar data de fechamento"
                title="Limpar data de fechamento"
                onClick={() => void salvarData(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {salvando === 'data' && <Salvando />}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        O preço estimado é o valor enviado para a Meta quando o lead é marcado como Ganho.
      </p>
    </CaixaDoCard>
  );
}
