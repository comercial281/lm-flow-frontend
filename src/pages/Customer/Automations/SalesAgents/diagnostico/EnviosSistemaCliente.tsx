import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { salesAgentsService, type WebhookDelivery } from '@/services/salesAgents/salesAgentsService';
import { dataHora, fraseDaResposta, segundos, situacaoDoEnvio, type Tom } from '@/features/salesAgents/sistemaDoCliente';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';

// Os últimos envios ao sistema do cliente, com a resposta dele (spec 05/10). É o
// que o gestor repassa a quem cuida do sistema quando o lead "não chegou": a frase
// em português primeiro, o trecho cru da resposta logo abaixo.

const COR: Record<Tom, string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  alerta: 'text-amber-700 dark:text-amber-400',
  erro: 'text-red-700 dark:text-red-400',
};

// ⚠️ A tela de conversas só abre pelo id longo (UUID). Link com o número curto da
// conversa cairia na lista vazia: some até o servidor mandar o id certo.
const UUID = /\/conversations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function linkQueAbre(path: string | null): boolean {
  return Boolean(path && UUID.test(path));
}

export default function EnviosSistemaCliente({ agentId }: { agentId: string }) {
  const [envios, setEnvios] = useState<WebhookDelivery[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setEnvios(await salesAgentsService.webhookDeliveries(agentId));
    } catch (e) {
      setErro(motivoDaFalha(e, 'Não consegui carregar os envios:'));
    }
  }, [agentId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section aria-labelledby="envios-sistema-cliente" className="mt-6">
      <div className="flex items-center justify-between">
        <h3 id="envios-sistema-cliente" className="text-sm font-medium">
          Últimos envios ao sistema do cliente
        </h3>
        <Button type="button" size="sm" variant="ghost" onClick={() => void carregar()}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
      {envios === null && !erro && <p className="text-xs text-muted-foreground mt-1">Carregando…</p>}
      {envios?.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Nenhum envio ainda. Use "Mandar um lead de teste" em Configurar → Objetivo.
        </p>
      )}

      <ul className="mt-2 divide-y divide-sidebar-border">
        {envios?.map((d) => {
          const s = situacaoDoEnvio(d);
          const quem = d.mode === 'test' ? 'Lead de teste' : d.contact_name ?? 'Lead';
          const estaAberto = aberto === d.id;
          return (
            <li key={d.id} className="py-2">
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-x-2 text-left text-xs"
                aria-expanded={estaAberto}
                onClick={() => setAberto(estaAberto ? null : d.id)}
              >
                <span className="text-muted-foreground">{dataHora(d.created_at)}</span>
                <span>{quem}</span>
                <span className={COR[s.tom]}>{s.texto}</span>
              </button>
              {estaAberto && (
                <div className="mt-1 space-y-1 text-xs">
                  {/* CVCRM: a frase do código é do envio genérico (fala de "chave secreta" no
                      401). Aqui quem fala é o status e o motivo que o servidor escreveu. */}
                  {d.system === 'cvcrm' ? (
                    d.status === 'delivered' && (
                      <p>O CVCRM cadastrou o lead{d.duration_ms != null ? ` em ${segundos(d.duration_ms)}` : ''}.</p>
                    )
                  ) : (
                    <p>
                      O sistema do cliente {fraseDaResposta(d.response_code)}
                      {d.duration_ms != null ? ` em ${segundos(d.duration_ms)}` : ''}.
                    </p>
                  )}
                  {/* CVCRM: quem ficou com o lead lá dentro (corretor, imobiliária ou gestor). */}
                  {d.remote_ref?.owner && <p>Ficou com {d.remote_ref.owner} no CVCRM.</p>}
                  {d.remote_ref?.existing && <p>O lead já existia no CVCRM: continua com quem já atendia.</p>}
                  {d.last_error && <p className="text-red-600">{d.last_error}</p>}
                  {d.response_excerpt && (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">
                      {d.response_excerpt}
                    </pre>
                  )}
                  {linkQueAbre(d.conversation_path) && (
                    <Link to={d.conversation_path!} className="underline">
                      Abrir a conversa
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
