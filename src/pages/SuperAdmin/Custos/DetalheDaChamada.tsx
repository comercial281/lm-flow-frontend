import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { dataHora, dinheiro, dolar, numero } from '@/lib/formato';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostCallDetail } from '@/types/admin/costs';
import { nomeFornecedor, tamanho } from './formatoCustos';

const QUEM: Record<string, string> = { conversation: 'Conversa', contact: 'Contato', user: 'Usuário', job: 'Rotina automática' };

// JSON.stringify devolve undefined pra undefined: nunca deixa isso virar tela em branco.
function texto(valor: unknown): string {
  try {
    return JSON.stringify(valor, null, 2) ?? '—';
  } catch {
    return String(valor);
  }
}

export default function DetalheDaChamada({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const [c, setC] = useState<CostCallDetail | null>(null);
  const [erro, setErro] = useState(false);
  const seq = useRef(0);

  const carregar = useCallback(() => {
    const minha = ++seq.current;
    setErro(false);
    setC(null);
    costsService.call(id)
      .then((r) => { if (minha === seq.current) setC(r); })
      .catch(() => { if (minha === seq.current) setErro(true); });
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const linha = (rotulo: string, valor: string) => (
    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{rotulo}</span><span className="text-right">{valor}</span></div>
  );

  return (
    <Sheet open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{c ? c.feature_label : 'Chamada'}</SheetTitle><SheetDescription className="sr-only">Detalhe da chamada de IA</SheetDescription></SheetHeader>
        {erro && <EmptyState tipo="erro" title="Não deu para abrir a chamada" aoTentarDeNovo={carregar} />}
        {c && (
          <>
            <div className="flex flex-col gap-2 px-4">
              {linha('Quando', dataHora(c.created_at))}
              {linha('Cliente', c.tenant_name)}
              {linha('Fornecedor e modelo', `${nomeFornecedor(c.provider)} · ${c.model ?? '—'}`)}
              {linha('Custo', c.priced ? `${dinheiro(c.cost_brl)} (${dolar(c.cost_usd, 4)})` : 'Sem preço na tabela')}
              {linha('Tamanho', tamanho(c))}
              {c.audio_seconds == null && c.characters == null &&
                linha('Entrada · saída · lido do cache · gravado no cache',
                  `${numero(c.input_tokens)} · ${numero(c.output_tokens)} · ${numero(c.cache_read_tokens)} · ${numero(c.cache_write_tokens)}`)}
              {linha('Tempo de resposta', c.latency_ms != null ? `${numero(c.latency_ms)} ms` : '—')}
              {linha('Quem disparou', c.trigger_type ? `${QUEM[c.trigger_type] ?? c.trigger_type}${c.trigger_id ? ` ${c.trigger_id}` : ''}` : 'Não informado')}
              {c.status === 'error' && linha('Erro', c.error_message ?? 'Sem mensagem')}
            </div>
            {c.payload_status === 'disponivel' ? (
              <div className="flex flex-col gap-3 px-4 pb-4">
                <h4 className="text-sm font-semibold">O que foi enviado</h4>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{texto(c.request)}</pre>
                <h4 className="text-sm font-semibold">O que voltou</h4>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{texto(c.response)}</pre>
              </div>
            ) : (
              <p className="px-4 text-sm text-muted-foreground">
                {c.payload_status === 'apagado' ? `Conteúdo apagado depois de ${c.payload_ttl_days} dias` : 'Conteúdo não foi guardado'}
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
