import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Badge,
} from '@/components/ui/ds';
import { Loader2, CheckCircle2, XCircle, MinusCircle, AlertTriangle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  leadAutomationService,
  LeadAutomationRule,
  AutomationTestResult,
  ACTION_TYPE_LABELS,
  ORIGIN_LABELS,
} from '@/services/leadAutomation/leadAutomationService';

// Nome de campo do lead como a pessoa vê na tela de automação — "source" não diz
// nada para quem escolheu "Origem do lead" num seletor.
const FIELD_LABELS: Record<string, string> = {
  source:            'Origem do lead',
  form_id:           'Formulário',
  form_name:         'Nome do formulário',
  campaign_name:     'Campanha',
  adset_name:        'Conjunto de anúncios',
  ad_name:           'Anúncio',
  ad_id:             'Anúncio (ID)',
  ad_title:          'Título do anúncio',
  label:             'Etiqueta',
  pipeline_id:       'Funil',
  pipeline_stage_id: 'Etapa do funil',
  contact_city:      'Cidade do lead',
  contact_state:     'Estado do lead',
  no_reply_minutes:  'Minutos sem resposta',
};

const STATUS_LOOK: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  sent:      { label: 'Enviado',  className: 'text-green-600',  Icon: CheckCircle2 },
  failed:    { label: 'Falhou',   className: 'text-destructive', Icon: XCircle },
  skipped:   { label: 'Não saiu', className: 'text-amber-600',  Icon: AlertTriangle },
  simulated: { label: 'Simulado', className: 'text-muted-foreground', Icon: MinusCircle },
};

function humanValue(value: string | string[] | null): string {
  if (value === null || value === undefined || value === '') return '(vazio)';
  if (Array.isArray(value)) return value.map(v => ORIGIN_LABELS[v] ?? v).join(', ');
  return ORIGIN_LABELS[value] ?? String(value);
}

interface Props {
  rule: LeadAutomationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Resultado do teste de uma automação: qual lead serviu de cobaia, que origem o
 * sistema enxergou nele, se a regra dispararia sozinha com um lead assim, e o
 * que cada aviso fez de fato (chegou, falhou, ou nem tentou e por quê).
 *
 * O teste manda o aviso DE VERDADE (é o ponto), marcado como teste na mensagem.
 * O que mexeria no CRM ou falaria com o lead fica simulado.
 */
export default function AutomationTestDialog({ rule, open, onOpenChange }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AutomationTestResult | null>(null);

  const run = async () => {
    if (!rule) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await leadAutomationService.testRun(rule.id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível testar esta automação'));
      onOpenChange(false);
    } finally {
      setRunning(false);
    }
  };

  // Abriu = testa. Quem clicou em "Testar" já pediu o teste; obrigar a um segundo
  // clique dentro do modal só adiciona passo.
  useEffect(() => {
    if (open && rule) run();
    if (!open) setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Teste da automação
          </DialogTitle>
          <DialogDescription>
            {rule?.name} — o aviso é enviado de verdade, marcado como teste na mensagem.
            Nada é movido, etiquetado ou mandado para o lead.
          </DialogDescription>
        </DialogHeader>

        {running && (
          <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Disparando o teste…
          </div>
        )}

        {!running && result && (
          <div className="space-y-5 text-sm">
            <section>
              <h4 className="font-medium mb-1">Lead usado no teste</h4>
              {result.lead_de_exemplo ? (
                <p className="text-muted-foreground">
                  Este CRM ainda não tem nenhum lead, então o teste usou um{' '}
                  <strong className="text-foreground">lead de exemplo</strong> (Maria, telefone
                  fictício). O aviso foi enviado de verdade — só os dados dentro dele é que são
                  inventados.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    {result.lead.name || 'Lead sem nome'}
                    {result.lead.phone ? ` · ${result.lead.phone}` : ''}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Origem que o sistema enxergou:{' '}
                    <strong className="text-foreground">
                      {ORIGIN_LABELS[result.origem.source ?? ''] ?? result.origem.source ?? '—'}
                    </strong>
                    {result.origem.form_name ? ` · formulário: ${result.origem.form_name}` : ''}
                    {result.origem.campaign_name ? ` · campanha: ${result.origem.campaign_name}` : ''}
                  </p>
                </>
              )}
            </section>

            <section>
              <h4 className="font-medium mb-1">Um lead assim dispararia a regra sozinho?</h4>
              {result.lead_de_exemplo ? (
                <p className="text-muted-foreground flex items-start gap-1.5">
                  <MinusCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Não dá para conferir sem um lead real — o lead de exemplo não tem origem, campanha
                  nem formulário. Quando o primeiro lead entrar, teste de novo para conferir os filtros.
                </p>
              ) : result.dispararia_sozinho ? (
                <p className="text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Sim — os filtros desta regra batem com este lead.
                </p>
              ) : (
                <p className="text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Não com ESTE lead — os filtros abaixo não bateram. O teste forçou o disparo mesmo assim.
                </p>
              )}

              {result.condicoes.length === 0 ? (
                <p className="text-muted-foreground mt-1">
                  A regra não tem filtro nenhum: vale para todo lead do gatilho.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {result.condicoes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {c.casou
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                      <span>
                        <strong>{FIELD_LABELS[c.campo] ?? c.campo}</strong>: a regra pede{' '}
                        <em>{humanValue(c.esperado)}</em> e o lead trouxe{' '}
                        <em>{humanValue(c.encontrado)}</em>.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="font-medium mb-1">O que a regra fez</h4>
              <ul className="space-y-1">
                {result.acoes.length === 0 && (
                  <li className="text-muted-foreground">Nenhuma ação foi executada.</li>
                )}
                {result.acoes.map((a, i) => {
                  const look = STATUS_LOOK[a.status] ?? STATUS_LOOK.skipped;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <look.Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${look.className}`} />
                      <span>
                        <strong>{ACTION_TYPE_LABELS[a.type] ?? a.type}</strong>
                        {' — '}
                        <span className={look.className}>{look.label}</span>
                        {a.detail ? <span className="text-muted-foreground"> · {a.detail}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {!result.avisos_ligados && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700">
                A chave <strong>Avisos das Automações de Lead</strong> está desligada para este CRM —
                enquanto ela estiver assim, nenhum aviso de automação sai. Ela fica em
                Configurações → Conta → Central de Notificações.
              </div>
            )}

            {!result.rule.is_active && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700">
                Esta automação está <strong>desligada</strong>. O teste roda mesmo assim, mas ela não
                vai disparar sozinha até ser ligada.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result && (
            <Badge variant="secondary" className="mr-auto text-xs">
              Gatilho: {result.rule.trigger}
            </Badge>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar de novo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
