import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds';
import { mayRead } from '@/store/appDataStore';
import { roletaConfigService, RoletaDiagnostic } from '@/services/roletaConfig/roletaConfigService';

/**
 * "Roleta" no dashboard — o mesmo diagnóstico da tela de Distribuição de Leads,
 * resumido, para admin, gestor e gerente.
 *
 * Por que aqui e não só na tela da roleta: quando um lead não entra, ninguém vai
 * conferir uma tela de configuração — o gestor descobre pelo corretor
 * reclamando, horas depois. O dashboard é onde ele já olha todo dia, e é o único
 * lugar em que a falha aparece antes de alguém procurar por ela.
 *
 * Mostra as FALHAS primeiro de propósito: sucesso é o esperado e não precisa de
 * espaço. Quando não há nenhuma, o cartão vira uma linha verde de "está rodando"
 * — que também é informação, porque distingue "sem problema" de "sem roleta".
 */
export default function DashboardRoletaSection() {
  const navigate = useNavigate();
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [falhas, setFalhas] = useState<RoletaDiagnostic[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // A permissão já existe para admin e gerente (role_seeder_service). O
      // corretor não tem, e sem esta guarda ele levaria um 403 vermelho ao abrir
      // o PRÓPRIO dashboard — o mesmo tropeço que os filtros de instância/equipe
      // já tiveram nesta página.
      const pode = await mayRead('roleta_configs.diagnostics').catch(() => false);
      if (!alive) return;
      setPermitido(pode);
      if (!pode) return;

      try {
        const res = await roletaConfigService.getDiagnostics({ limit: 60 });
        if (!alive) return;
        const linhas = res ?? [];
        setTotal(linhas.length);
        setFalhas(linhas.filter(l => !l.ok).slice(0, 5));
      } catch {
        // Silencioso: o dashboard inteiro não pode ficar vermelho porque a
        // trilha da roleta não respondeu.
        if (alive) setFalhas([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Sem permissão, o cartão não existe — nem esqueleto, nem "acesso negado".
  if (permitido === false) return null;
  if (permitido === null || falhas === null) return null;

  // Nunca houve distribuição: mostrar "tudo certo" aqui seria mentira, e mostrar
  // um cartão vazio seria ruído. Some.
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shuffle className="h-4 w-4" />
          Roleta
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings/roleta-config')}
        >
          Ver tudo
        </Button>
      </CardHeader>

      <CardContent>
        {falhas.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Os últimos {total} leads entraram na roleta sem falha.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {falhas.length === 1
                ? '1 lead não entrou na roleta:'
                : `${falhas.length} leads não entraram na roleta:`}
            </p>
            {falhas.map(f => (
              <div
                key={f.id}
                className="flex items-start gap-2 rounded-md border border-border p-2 text-xs"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{f.lead || 'Lead sem nome'}</span>
                    {/* Com várias roletas, "não entrou" sem dizer ONDE não é
                        diagnóstico — e é justamente aqui, fora da tela de uma
                        roleta específica, que a etiqueta faz falta. */}
                    {f.roleta && (
                      <Badge variant="outline" className="text-[10px]">{f.roleta}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{f.explicacao}</p>
                  {/* Alguém já resolveu na mão: continua sendo falha da roleta,
                      mas não é mais lead abandonado — e essa diferença muda o
                      que o gestor faz agora. */}
                  {f.dono_atual && (
                    <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                      Hoje é de {f.dono_atual}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
