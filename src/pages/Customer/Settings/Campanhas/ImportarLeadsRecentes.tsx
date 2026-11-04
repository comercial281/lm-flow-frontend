// Importar leads recentes que não entraram (backfill). Saiu de LeadAdsForms na Tarefa 8 (04/11/2026), sem mudar o comportamento:
// "Conferir" mostra quantos faltam (dry-run) e só então libera o "Importar".
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela } from '@/components/base/janela';
import { Seletor } from '@/components/base/Seletor';
import { plural } from '@/lib/formato';
import { leadAdsFormsService, type BackfillResult } from '@/services/leadAds/leadAdsFormsService';

const campoDaJanelaClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function ImportarLeadsRecentes({ aberto, aoMudarAberto, aoImportou }: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  /** Importou de verdade: recarregar a lista. */
  aoImportou: () => void;
}) {
  const [backfillDays, setBackfillDays] = useState(3);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState<BackfillResult | null>(null);

  // Abriu de novo: a conferência de antes não vale mais.
  useEffect(() => { if (aberto) setBackfillPreview(null); }, [aberto]);

  const runBackfill = async (dryRun: boolean) => {
    setBackfillBusy(true);
    try {
      const r = await leadAdsFormsService.backfill(backfillDays, dryRun);
      setBackfillPreview(r);
      if (!dryRun) {
        toast.success(plural(r.importados, 'lead importado', 'leads importados'));
        aoImportou();
      }
    } catch {
      toast.error('Erro ao importar leads');
    } finally {
      setBackfillBusy(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar leads recentes</DialogTitle>
          <DialogDescription>
            Busca no Facebook os leads dos formulários e traz pro CRM os que ainda não entraram.
            Não duplica os que já existem.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <CampoDaJanela rotulo="Período" htmlFor="bf_days" obrigatorio>
            <Seletor id="bf_days" value={backfillDays}
              onChange={e => { setBackfillDays(Number(e.target.value)); setBackfillPreview(null); }}
              className={campoDaJanelaClass}>
              <option value={1}>Último 1 dia</option>
              <option value={3}>Últimos 3 dias</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={15}>Últimos 15 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </Seletor>
          </CampoDaJanela>

          {backfillPreview && (
            <Aviso tom="info" compacto>
              <p>Encontrados: <strong>{backfillPreview.total_leads}</strong></p>
              <p>Já no CRM: <strong>{backfillPreview.ja_no_crm}</strong></p>
              <p>Faltam entrar: <strong>{backfillPreview.faltavam}</strong></p>
            </Aviso>
          )}
          {backfillPreview && backfillPreview.dry_run === false && (
            <Aviso tom="sucesso" compacto>
              Importados agora: <strong>{backfillPreview.importados}</strong>
            </Aviso>
          )}

          {/* Passo 1 (Conferir) libera o passo 2 (Importar). Sem esse aviso o botão
              roxo "Importar" nasce desabilitado e parece quebrado — o cliente não
              descobre que precisa conferir antes. */}
          {!backfillPreview && !backfillBusy && (
            <Aviso tom="info" compacto>
              Passo 1: clique em <strong>Conferir</strong> para ver quantos leads faltam.
              Isso libera o botão <strong>Importar</strong>.
            </Aviso>
          )}

          <Aviso tom="neutro" compacto>
            Dica: confira primeiro. Ao importar, os leads entram no funil e podem disparar as
            automações de entrada. Desative o primeiro contato antes se não quiser avisar leads antigos.
          </Aviso>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => runBackfill(true)} disabled={backfillBusy}>
            {backfillBusy ? 'Conferindo...' : backfillPreview ? 'Conferir de novo' : 'Conferir'}
          </Button>
          <Button onClick={() => runBackfill(false)}
            disabled={backfillBusy || !backfillPreview || backfillPreview.faltavam === 0}
            title={
              !backfillPreview
                ? 'Clique em "Conferir" primeiro para ver quantos leads faltam entrar'
                : backfillPreview.faltavam === 0
                  ? 'Nenhum lead novo para importar — está tudo no CRM'
                  : undefined
            }>
            {backfillBusy ? 'Importando...' : `Importar${backfillPreview ? ` ${backfillPreview.faltavam}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
