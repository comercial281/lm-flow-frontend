import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import {
  salesAgentsService,
  type CvcrmEscolha,
  type CvcrmOpcoes,
  type HandoffCvcrm,
  type WebhookTestResult,
} from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import { segundos } from '@/features/salesAgents/sistemaDoCliente';
import { Aviso } from './pecas';

// Sistema do cliente → CVCRM (06/10/2026). O lead é cadastrado direto no CVCRM do
// cliente, pela conexão de Integrações → CVCRM (uma por cliente). Aqui a IA só
// escolhe o empreendimento e a fila, das listas do CVCRM dele; os dois opcionais
// ("Deixar o CVCRM decidir").
//
// ⚠️ O nome escolhido fica guardado junto do número: com o CVCRM fora do ar (ou o
// empreendimento desativado lá), a escolha continua aparecendo.
// ⚠️ O teste usa o que está GRAVADO: com a troca por salvar, fica bloqueado.

interface Props {
  agentId: string;
  valor: HandoffCvcrm;
  aoMudar: (v: HandoffCvcrm) => void;
  /** O CVCRM já está gravado como forma de envio, sem nada por salvar no passo. */
  podeTestar: boolean;
}

const DECIDIR = '';

function opcoesCom(lista: CvcrmEscolha[], escolhida: CvcrmEscolha | null): CvcrmEscolha[] {
  if (!escolhida || lista.some((i) => i.id === escolhida.id)) return lista;
  return [...lista, { id: escolhida.id, nome: `${escolhida.nome ?? `#${escolhida.id}`} (não veio na lista do CVCRM)` }];
}

export default function SistemaDoClienteCvcrm({ agentId, valor, aoMudar, podeTestar }: Props) {
  const [opcoes, setOpcoes] = useState<CvcrmOpcoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhaGeral, setFalhaGeral] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<WebhookTestResult | null>(null);

  useEffect(() => {
    let vivo = true;
    salesAgentsService.cvcrmOptions()
      .then((o) => { if (vivo) setOpcoes(o); })
      .catch((e) => { if (vivo) setFalhaGeral(motivoDaFalha(e, 'Não consegui ler o CVCRM agora:')); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const escolher = (campo: keyof HandoffCvcrm, lista: CvcrmEscolha[], id: string) => {
    const item = id === DECIDIR ? null : lista.find((i) => String(i.id) === id) ?? valor[campo];
    aoMudar({ ...valor, [campo]: item ? { id: item.id, nome: item.nome } : null });
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

  if (carregando) {
    return <p className="mt-2 ml-7 text-sm text-muted-foreground">Lendo o CVCRM do cliente…</p>;
  }

  // Sem as listas, a escolha guardada continua à vista (o envio usa ela do mesmo jeito).
  const guardada = [
    valor.empreendimento && `Empreendimento: ${valor.empreendimento.nome ?? `#${valor.empreendimento.id}`}`,
    valor.fila && `Fila: ${valor.fila.nome ?? `#${valor.fila.id}`}`,
  ].filter(Boolean).join(' · ');

  if (falhaGeral) {
    return (
      <div className="mt-2 ml-7 space-y-2">
        <Aviso tom="vermelho">{falhaGeral}</Aviso>
        <p className="text-sm text-muted-foreground">{guardada || 'Escolhido: deixar o CVCRM decidir empreendimento e fila.'}</p>
      </div>
    );
  }

  if (!opcoes?.connected) {
    return (
      <div className="mt-2 ml-7">
        <Aviso>
          <p>Este cliente ainda não conectou o CVCRM. Sem a conexão, a IA não liga com este destino.</p>
          <Button asChild size="sm" variant="outline" className="mt-2">
            <Link to="/settings/cvcrm">Conectar o CVCRM</Link>
          </Button>
        </Aviso>
      </div>
    );
  }

  const empreendimentos = opcoesCom(opcoes.empreendimentos, valor.empreendimento);
  const filas = opcoesCom(opcoes.filas, valor.fila);
  const tempo = teste?.duration_ms != null ? ` · ${segundos(teste.duration_ms)}` : '';

  return (
    <div className="mt-2 ml-7 space-y-4">
      <p className="text-sm text-muted-foreground">
        O lead entra no CVCRM <span className="font-medium text-foreground">{opcoes.subdomain}.cvcrm.com.br</span> com o resumo da IA, e o CVCRM distribui pela regra dele.
      </p>

      <Campo id="p2-cvcrm-empreendimento" rotulo="Empreendimento" erro={opcoes.errors.empreendimentos ?? undefined}>
        <Seletor id="p2-cvcrm-empreendimento" className={`${CLASSE_DO_CAMPO} w-full`}
          value={valor.empreendimento ? String(valor.empreendimento.id) : DECIDIR}
          onChange={(e) => escolher('empreendimento', empreendimentos, e.target.value)}>
          <option value={DECIDIR}>Deixar o CVCRM decidir</option>
          {empreendimentos.map((i) => <option key={i.id} value={String(i.id)}>{i.nome}</option>)}
        </Seletor>
      </Campo>

      <Campo id="p2-cvcrm-fila" rotulo="Fila de distribuição" erro={opcoes.errors.filas ?? undefined}
        ajuda="A fila do CVCRM que escolhe o corretor. Sem fila, vale a regra padrão do CVCRM.">
        <Seletor id="p2-cvcrm-fila" className={`${CLASSE_DO_CAMPO} w-full`}
          value={valor.fila ? String(valor.fila.id) : DECIDIR}
          onChange={(e) => escolher('fila', filas, e.target.value)}>
          <option value={DECIDIR}>Deixar o CVCRM decidir</option>
          {filas.map((i) => <option key={i.id} value={String(i.id)}>{i.nome}</option>)}
        </Seletor>
      </Campo>

      <div>
        <Button type="button" size="sm" variant="outline" onClick={testar} disabled={!podeTestar || testando}>
          {testando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Mandar um lead de teste
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          {podeTestar
            ? 'O teste cria um lead de verdade no CVCRM do cliente, com o nome "Teste LM Flow". Exclua por lá depois.'
            : 'Salve o passo antes de testar.'}
        </p>
        {teste && (
          <div role="status"
            className={`mt-2 rounded-md border p-3 ${teste.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs font-medium">
              {teste.ok
                ? `Chegou: o lead de teste foi cadastrado no CVCRM${teste.remote_ref?.owner ? ` e ficou com ${teste.remote_ref.owner}` : ''}${tempo}`
                : `Não chegou: ${teste.error ?? 'o CVCRM recusou o envio'}${tempo}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
