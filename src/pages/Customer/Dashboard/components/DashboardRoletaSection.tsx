import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui/ds';
import { mayRead } from '@/store/appDataStore';
import { roletaConfigService, RoletaConfig } from '@/services/roletaConfig/roletaConfigService';

/**
 * Cartão "Roleta" na fileira de KPIs — quem está recebendo lead agora.
 *
 * Fica junto do Ticket médio de propósito: a pergunta "a roleta está girando e
 * pra quem?" é do mesmo tipo das outras daquela fileira, e é a que o gestor faz
 * todo dia. Escondida numa tela de configuração, ninguém abre.
 *
 * Ocupa duas colunas (`sm:col-span-2`) porque o conteúdo é uma LISTA de pessoas,
 * não um número — no espaço de um KPI normal os nomes truncariam e o cartão
 * viraria enfeite.
 *
 * Mostra o percentual EFETIVO de cada corretor: com mais de um número, a chance
 * dele é (peso do número ÷ soma dos números) × (peso dele ÷ soma da instância
 * dele). Mostrar só `peso/soma` faria o gestor ler números que não acontecem —
 * é a mesma conta da tela de configuração, e as duas precisam concordar.
 */

interface Linha {
  nome: string;
  corretores: { nome: string; pct: number | null }[];
  ativa: boolean;
  multi: boolean;
}

function montarLinha(c: RoletaConfig): Linha {
  const membrosAtivos = (c.members ?? []).filter(m => m.is_active && m.user_id);
  const instancias = (c.instances ?? []).filter(i => i.is_active !== false);
  const somaInstancias = instancias.reduce((s, i) => s + (i.weight ?? 0), 0);

  // Sem instâncias (roleta legada de número único) a fatia do número é 1 — a
  // conta degrada para o peso simples, que era o comportamento de antes.
  const pctDe = (m: (typeof membrosAtivos)[number]): number | null => {
    const doMembro = m.weight ?? 0;
    const irmaos = membrosAtivos.filter(o =>
      instancias.length > 1 ? o.inbox_id === m.inbox_id : true,
    );
    const somaIrmaos = irmaos.reduce((s, o) => s + (o.weight ?? 0), 0);
    if (somaIrmaos <= 0) return null;

    if (instancias.length <= 1 || somaInstancias <= 0) {
      return (doMembro / somaIrmaos) * 100;
    }
    const inst = instancias.find(i => i.inbox_id === m.inbox_id);
    const fatiaNumero = (inst?.weight ?? 0) / somaInstancias;
    return fatiaNumero * (doMembro / somaIrmaos) * 100;
  };

  return {
    nome: c.display_name || c.inbox_name || 'Roleta',
    ativa: c.is_active,
    multi: instancias.length > 1,
    corretores: membrosAtivos
      .map(m => ({ nome: m.user_name || 'Sem nome', pct: pctDe(m) }))
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)),
  };
}

export default function DashboardRoletaSection() {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // O corretor não lê roletas, e sem esta guarda ele levaria um 403 vermelho
      // ao abrir o PRÓPRIO dashboard — o mesmo tropeço que os filtros de
      // instância/equipe desta página já tiveram.
      const pode = await mayRead('roleta_configs.read').catch(() => false);
      if (!alive) return;
      if (!pode) return setLinhas([]);

      try {
        const configs = await roletaConfigService.getAll();
        if (!alive) return;
        setLinhas(configs.map(montarLinha));
      } catch {
        // Silencioso: o dashboard inteiro não pode ficar vermelho porque a
        // roleta não respondeu.
        if (alive) setLinhas([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Sem permissão, sem roleta ou ainda carregando: o cartão não existe. Um
  // esqueleto aqui roubaria uma coluna da fileira de KPIs por nada.
  if (!linhas?.length) return null;

  return (
    <Card
      className="sm:col-span-2 cursor-pointer transition-colors hover:bg-muted/40"
      onClick={() => navigate('/settings/roleta-config')}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-violet-500/15 p-2">
            <Shuffle className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Roleta</p>
            <p className="text-xs text-muted-foreground">Quem está recebendo lead</p>
          </div>
        </div>

        <div className="space-y-3">
          {linhas.map(l => (
            <div key={l.nome}>
              <div className="mb-1 flex items-center gap-2">
                <span className="truncate text-xs font-medium">{l.nome}</span>
                {l.multi && (
                  <Badge variant="outline" className="text-[10px]">multinúmero</Badge>
                )}
                {/* Roleta desativada continua na lista de propósito: sumir faria
                    o gestor achar que ela não existe, quando o problema é que
                    alguém a desligou. */}
                {!l.ativa && (
                  <span className="text-[10px] text-muted-foreground">(desativada)</span>
                )}
              </div>

              {l.corretores.length === 0 ? (
                <p className="text-xs text-destructive">
                  Nenhum corretor ativo — esta roleta não distribui nada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {l.corretores.map(c => (
                    <span
                      key={c.nome}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]"
                    >
                      {c.nome}
                      {c.pct !== null && (
                        <span className="text-muted-foreground">{c.pct.toFixed(0)}%</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
