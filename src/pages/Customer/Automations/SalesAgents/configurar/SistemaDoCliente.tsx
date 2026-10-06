import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, Send } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui/ds';
import { salesAgentsService, type WebhookTestResult } from '@/services/salesAgents/salesAgentsService';
import { fraseDaResposta, problemaNoEndereco, segundos } from '@/features/salesAgents/sistemaDoCliente';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';

// Sistema do cliente (05/10/2026): o bloco que aparece quando o destino do lead é o
// sistema que a imobiliária já usa. Três coisas, nesta ordem: o endereço (grava
// ao sair do campo, na página Destino), a chave secreta (gerada pelo LM Flow e
// mostrada UMA vez) e o lead de teste (usa o endereço e a chave GRAVADOS — por isso
// fica bloqueado com o endereço por salvar).

interface Props {
  agentId: string;
  /** O que está no campo agora (rascunho do passo). */
  url: string;
  /** O que está gravado no servidor. */
  urlSalva: string | null;
  chaveGerada: boolean;
  /** A chave gravada não abre mais no servidor (`handoff_webhook_secret_state = 'unreadable'`). */
  chaveIlegivel?: boolean;
  onUrlChange: (url: string) => void;
  /** Saiu do campo do endereço (a página grava ali, não por tecla). */
  onUrlBlur?: () => void;
  onChaveGerada: () => void;
}

export default function SistemaDoCliente({ agentId, url, urlSalva, chaveGerada, chaveIlegivel = false, onUrlChange, onUrlBlur, onChaveGerada }: Props) {
  const [chaveNova, setChaveNova] = useState<string | null>(null);
  const [confirmandoOutra, setConfirmandoOutra] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<WebhookTestResult | null>(null);

  const problema = url.trim() ? problemaNoEndereco(url) : null;
  const naoSalvo = url.trim() !== (urlSalva ?? '').trim();
  const temChave = chaveGerada || Boolean(chaveNova);
  const podeTestar = !naoSalvo && Boolean(urlSalva) && temChave;

  const gerar = async () => {
    setGerando(true);
    try {
      // ⚠️ Com chave já gerada o servidor exige a confirmação ("Sim, gerar outra").
      const chave = await salesAgentsService.generateWebhookSecret(agentId, chaveGerada ? { confirm: true } : {});
      setChaveNova(chave);
      setConfirmandoOutra(false);
      onChaveGerada();
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui gerar a chave:'));
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    if (!chaveNova) return;
    try {
      await navigator.clipboard.writeText(chaveNova);
      toast.success('Chave copiada');
    } catch {
      toast.error('Não consegui copiar. Selecione a chave e copie com Ctrl+C.');
    }
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    try {
      setTeste(await salesAgentsService.testWebhook(agentId));
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui mandar o lead de teste:'));
    } finally {
      setTestando(false);
    }
  };

  const fraseDoTeste = (t: WebhookTestResult) => {
    const tempo = t.duration_ms != null ? ` · ${segundos(t.duration_ms)}` : '';
    if (t.ok) return `Chegou: o sistema do cliente ${fraseDaResposta(t.response_code)}${tempo}`;
    return `Não chegou: ${t.error ?? `o sistema do cliente ${fraseDaResposta(t.response_code)}`}${tempo}`;
  };

  return (
    <div className="mt-2 ml-7 space-y-4">
      <div>
        <Label htmlFor="handoff_webhook_url">Endereço do sistema do cliente</Label>
        <Input
          id="handoff_webhook_url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onBlur={onUrlBlur}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Quem cuida do sistema da imobiliária passa este endereço. Precisa começar com https://.
        </p>
        {problema && <p className="text-xs text-amber-600 mt-1">{problema}</p>}
      </div>

      <div>
        <div className="text-sm font-medium">Chave secreta</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Com ela o sistema do cliente confere que o lead veio mesmo do LM Flow.
        </p>

        {chaveNova ? (
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-900/20">
            <code className="block break-all text-xs">{chaveNova}</code>
            <p className="text-xs mt-2">
              Copie agora e entregue a quem cuida do sistema do cliente. Por segurança, ela não aparece de novo.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={copiar}>
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
        ) : chaveGerada ? (
          confirmandoOutra ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs">A chave atual para de valer na hora. O sistema do cliente vai precisar da nova.</span>
              <Button type="button" size="sm" onClick={gerar} disabled={gerando}>
                {gerando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Sim, gerar outra
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmandoOutra(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={chaveIlegivel ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {chaveIlegivel ? 'A chave gravada não abre mais. Gere outra e entregue ao sistema do cliente.' : 'Chave gerada. Se ela se perdeu, gere outra.'}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmandoOutra(true)}>
                Gerar outra chave
              </Button>
            </div>
          )
        ) : (
          <>
            <p className="mt-2 text-xs text-destructive">Sem a chave, nenhum lead é enviado ao sistema do cliente.</p>
            <Button type="button" size="sm" className="mt-2" onClick={gerar} disabled={gerando}>
              {gerando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Gerar chave secreta
            </Button>
          </>
        )}
      </div>

      <div>
        <Button type="button" size="sm" variant="outline" onClick={testar} disabled={!podeTestar || testando}>
          {testando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Mandar um lead de teste
        </Button>
        {!podeTestar && (
          <p className="text-xs text-muted-foreground mt-1">
            {naoSalvo ? 'Salve o endereço antes de testar.' : 'Preencha o endereço, salve e gere a chave antes de testar.'}
          </p>
        )}
        {teste && (
          <div
            role="status"
            className={`mt-2 rounded-md border p-3 ${teste.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}
          >
            <p className="text-xs font-medium">{fraseDoTeste(teste)}</p>
            {teste.response_excerpt && (
              <pre className="mt-1 whitespace-pre-wrap break-all text-[11px]">{teste.response_excerpt}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
