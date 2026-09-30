import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, MessageSquare, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { roletaConfigService, type RoletaExhaustedLead } from '@/services/roletaConfig/roletaConfigService';
import { passouPorTexto, resumoSorteioEmLote } from './exhaustedText';
import { telefone } from '@/lib/formato';

// ── LEADS QUE ESGOTARAM A ROLETA ─────────────────────────────────────────────
//
// O lead que passa por todos os corretores sem ninguém assumir PARA: fica sem
// responsável e não volta sozinho. Até 30/09/2026 o único rastro era o aviso no
// WhatsApp do gestor e uma linha no Diagnóstico, misturada a todo o resto — três
// leads da madrugada rodaram por dez corretores cada e ninguém viu.
//
// Some sozinho quando não há nenhum: é alerta, não seção fixa da tela.
// A lista vem do pai (a aba mostra a contagem mesmo fechada); aqui só as ações.
interface Props {
  items: RoletaExhaustedLead[];
  /** Recarrega a lista e as atribuições depois de sortear. */
  onChanged: () => void;
}

export default function ExhaustedLeadsPanel({ items, onChanged }: Props) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const podeSortear = can('roleta_configs', 'assign');

  const [sorteando, setSorteando] = useState<string | null>(null);
  const [emLote, setEmLote] = useState(false);
  // O motivo de cada lead que não saiu, na linha dele. Um toast por falha no
  // "Sortear todos" empilharia dez avisos iguais que somem antes de serem lidos.
  const [erros, setErros] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  const sorteaveis = items.filter(i => i.pode_sortear);
  const ocupado = emLote || sorteando !== null;

  async function sortear(item: RoletaExhaustedLead): Promise<boolean> {
    try {
      const r = await roletaConfigService.redistributeExhausted(item.contact_id);
      setErros(e => {
        const resto = { ...e };
        delete resto[item.contact_id];
        return resto;
      });
      return Boolean(r);
    } catch (err) {
      setErros(e => ({ ...e, [item.contact_id]: apiErrorMessage(err, 'Não foi possível sortear de novo.') }));
      return false;
    }
  }

  async function sortearUm(item: RoletaExhaustedLead) {
    setSorteando(item.contact_id);
    try {
      if (await sortear(item)) {
        toast.success(`${item.lead} voltou para a roleta`);
        onChanged();
      }
    } finally {
      setSorteando(null);
    }
  }

  async function sortearTodos() {
    const ok = await confirmar({
      titulo: `Sortear ${sorteaveis.length} leads de novo`,
      descricao:
        'Cada um volta para a roleta de onde saiu, como se tivesse acabado de chegar: ' +
        'os corretores recebem a oferta de novo, um de cada vez, com o prazo normal.',
      rotuloDaAcao: 'Sortear todos',
    });
    if (!ok) return;

    setEmLote(true);
    let sorteados = 0;
    let falharam = 0;
    try {
      // Um de cada vez, de propósito: no modo Fila a vez anda a cada oferta, e o
      // servidor trava a roleta para não dar dois leads ao mesmo corretor.
      for (const item of sorteaveis) {
        if (await sortear(item)) sorteados += 1;
        else falharam += 1;
      }
    } finally {
      setEmLote(false);
    }
    const texto = resumoSorteioEmLote(sorteados, falharam);
    if (falharam > 0) toast.warning(texto); else toast.success(texto);
    onChanged();
  }

  return (
    <div className="border border-amber-300 dark:border-amber-800 rounded-lg p-4 bg-amber-50/60 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              Esgotaram a roleta e estão sem responsável ({items.length})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Passaram por todos os corretores e ninguém assumiu no prazo. Eles não voltam
              sozinhos: sorteie de novo ou atribua na mão pelo card.
            </p>
          </div>
        </div>
        {podeSortear && sorteaveis.length > 1 && (
          <Button variant="outline" size="sm" onClick={sortearTodos} disabled={ocupado} className="gap-1.5 shrink-0">
            {emLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
            Sortear todos de novo ({sorteaveis.length})
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items.map(item => {
          const conversa = item.conversation_display_id ?? item.conversation_id;
          const erro = erros[item.contact_id];
          return (
            <div key={item.contact_id} className="border rounded-lg p-3 bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {item.lead}
                    {item.lead_telefone && item.lead_telefone !== item.lead && (
                      <span className="text-xs text-muted-foreground font-normal"> · {telefone(item.lead_telefone)}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.roleta ?? 'Roleta'} · esgotou em {formatDateTimeBR(item.esgotou_em)}
                  </p>
                  {item.passou_por.length > 0 && (
                    <p className="text-xs text-muted-foreground" title={item.passou_por.join(', ')}>
                      {passouPorTexto(item.passou_por)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conversa && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/conversations/${conversa}`)} className="gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Abrir conversa
                    </Button>
                  )}
                  {podeSortear && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sortearUm(item)}
                      disabled={!item.pode_sortear || ocupado}
                      className="gap-1.5"
                    >
                      {sorteando === item.contact_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Shuffle className="h-3.5 w-3.5" />}
                      Sortear de novo
                    </Button>
                  )}
                </div>
              </div>
              {/* O motivo aparece ANTES do clique: botão cinza sem explicação é o
                  "está quebrado" que o gestor reporta. */}
              {!item.pode_sortear && item.bloqueio && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{item.bloqueio}</p>
              )}
              {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
            </div>
          );
        })}
      </div>

      {!podeSortear && (
        <p className="text-xs text-muted-foreground mt-3">
          Seu cargo não permite sortear de novo. Peça ao gestor ou ao administrador.
        </p>
      )}

      {dialogoDeConfirmacao}
    </div>
  );
}
