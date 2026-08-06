import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { mayRead } from '@/store/appDataStore';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { EmptyBlock, GlassCard } from './primitives';

/**
 * Cartão "Roleta" — quem está recebendo lead agora.
 *
 * Fica logo abaixo da fileira de KPIs de propósito: a pergunta "a roleta está
 * girando e pra quem?" é do mesmo tipo das outras daquela fileira, e é a que o
 * gestor faz todo dia. Escondida numa tela de configuração, ninguém abre.
 *
 * Mostra o percentual EFETIVO de cada corretor: com mais de um número, a chance
 * dele é (peso do número ÷ soma dos números) × (peso dele ÷ soma da instância
 * dele). Mostrar só `peso/soma` faria o gestor ler números que não acontecem —
 * é a mesma conta da tela de configuração, e as duas precisam concordar.
 *
 * Este bloco NÃO vem do payload de /dashboard/metrics: a roleta tem endpoint
 * próprio e permissão própria (`roleta_configs.read`), que o corretor não tem.
 * Sem dado, o cartão não existe — nunca desenha vazio.
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

export const RoletaSection: React.FC = () => {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // O corretor não lê roletas, e sem esta guarda ele levaria um 403 vermelho
      // ao abrir o PRÓPRIO dashboard — o mesmo tropeço que os filtros de
      // instância/equipe do dashboard antigo já tiveram.
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
    return () => {
      alive = false;
    };
  }, []);

  // Sem permissão, sem roleta ou ainda carregando: o cartão não existe. Um
  // esqueleto aqui roubaria uma faixa da tela por nada.
  if (!linhas?.length) return null;

  // A margem mora aqui, e não no pai: quando o cartão não existe (corretor), o
  // pai não pode deixar um vão de 18px sobrando no lugar dele.
  return (
    <div style={{ marginTop: 18 }}>
      <GlassCard
        title="Roleta"
        subtitle="Quem está recebendo lead agora"
        className="cursor-pointer"
        action={
          <span className="lmf-kpi-icon" aria-hidden>
            <Shuffle size={15} />
          </span>
        }
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/settings/roleta-config')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/settings/roleta-config');
          }}
        >
          <ul>
            {linhas.map(l => (
              <li key={l.nome} className="lmf-row" style={{ display: 'block' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="lmf-row-title truncate">{l.nome}</span>
                  {l.multi && <span className="lmf-pill">multinúmero</span>}
                  {/* Roleta desativada continua na lista de propósito: sumir faria
                      o gestor achar que ela não existe, quando o problema é que
                      alguém a desligou. */}
                  {!l.ativa && (
                    <span className="lmf-pill" data-tone="warn">
                      desativada
                    </span>
                  )}
                </div>

                {l.corretores.length === 0 ? (
                  <EmptyBlock text="Nenhum corretor ativo — esta roleta não distribui nada." />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {l.corretores.map(c => (
                      <span key={c.nome} className="lmf-pill">
                        {c.nome}
                        {c.pct !== null && (
                          <span style={{ opacity: 0.7, marginLeft: 4 }}>{c.pct.toFixed(0)}%</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>
    </div>
  );
};

export default RoletaSection;
