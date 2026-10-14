import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { salesAgentsService, type TestNoticeResult } from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';

// "Mandar um aviso de teste" (14/10/2026), na página Destino quando o lead vai pra
// uma roleta, um corretor fixo ou o dono do número. Quem receberia o lead ganha o
// aviso de oferta no WhatsApp, marcado TESTE, e quem clicou recebe a cópia: o
// gestor e o corretor veem o fluxo antes do primeiro lead de verdade.
// ⚠️ Usa o destino GRAVADO (o servidor resolve): a página só mostra o botão com o
// destino já escolhido. Nada é criado: nem lead, nem oferta, nem vez da roleta.

const tituloDoResultado = (r: TestNoticeResult) => {
  if (r.error) return r.error;
  if (r.ok && r.sent_to?.length) return `Aviso de teste enviado pra ${r.sent_to.join(' e ')}.`;
  return 'O aviso de teste não foi enviado.';
};

export default function AvisoDeTeste({ agentId }: { agentId: string }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<TestNoticeResult | null>(null);

  const testar = async () => {
    setTestando(true);
    setResultado(null);
    try {
      setResultado(await salesAgentsService.testNotice(agentId));
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui mandar o aviso de teste:'));
    } finally {
      setTestando(false);
    }
  };

  return (
    <div>
      <Button type="button" size="sm" variant="outline" onClick={testar} disabled={testando}>
        {testando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
        Mandar um aviso de teste
      </Button>
      <p className="text-xs text-muted-foreground mt-1">
        Quem receberia o lead ganha o aviso no WhatsApp, marcado como teste, e você recebe uma cópia. Nenhum lead é criado e a vez da roleta não anda.
      </p>
      {resultado && (
        <Aviso tom={resultado.ok ? 'sucesso' : 'atencao'} compacto className="mt-2">
          <p className="font-medium">{tituloDoResultado(resultado)}</p>
          {!!resultado.lines?.length && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {resultado.lines.map((linha) => <li key={linha}>{linha}</li>)}
            </ul>
          )}
        </Aviso>
      )}
    </div>
  );
}
