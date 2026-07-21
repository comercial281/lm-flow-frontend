import React, { useMemo, useState } from 'react';
import { EmptyBlock, formatNumber } from './primitives';
import type { HeatmapBlock } from '../types';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Mapa de calor de mensagens recebidas: dia da semana x hora.
 *
 * A diferença para o mapa antigo é o hover: ele mostra A QUANTIDADE. Sem o
 * número, a cor sozinha só diz "mais ou menos que a outra célula", e não dá pra
 * decidir escala de plantão com isso.
 */
export const Heatmap: React.FC<{ heatmap: HeatmapBlock }> = ({ heatmap }) => {
  const [hover, setHover] = useState<{ day: number; hour: number; count: number } | null>(null);

  const grid = useMemo(() => {
    const map = new Map<string, number>();
    heatmap.cells.forEach(c => map.set(`${c.day}-${c.hour}`, c.count));
    return map;
  }, [heatmap.cells]);

  if (!heatmap.total) return <EmptyBlock text="Nenhuma mensagem recebida neste período." />;

  const max = heatmap.max || 1;

  return (
    <div>
      <div
        className="flex items-center justify-between mb-3"
        style={{ fontSize: 12, color: 'var(--lmf-muted)', minHeight: 20 }}
      >
        <span>{formatNumber(heatmap.total)} mensagens recebidas</span>
        <span aria-live="polite">
          {hover
            ? `${DAYS[hover.day]} às ${String(hover.hour).padStart(2, '0')}h — ${formatNumber(hover.count)} ${
                hover.count === 1 ? 'mensagem' : 'mensagens'
              }`
            : 'Passe o mouse para ver a quantidade'}
        </span>
      </div>

      <div className="lmf-heat">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={`h-${h}`} className="lmf-heat-axis" style={{ textAlign: 'center', paddingRight: 0 }}>
            {h % 3 === 0 ? h : ''}
          </span>
        ))}

        {DAYS.map((label, day) => (
          <React.Fragment key={label}>
            <span className="lmf-heat-axis">{label}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = grid.get(`${day}-${hour}`) || 0;
              return (
                <div
                  key={`${day}-${hour}`}
                  className="lmf-heat-cell"
                  style={{ ['--i' as string]: String(count / max) }}
                  onMouseEnter={() => setHover({ day, hour, count })}
                  onMouseLeave={() => setHover(null)}
                  title={`${label} ${String(hour).padStart(2, '0')}h — ${formatNumber(count)} ${
                    count === 1 ? 'mensagem' : 'mensagens'
                  }`}
                  role="img"
                  aria-label={`${label} ${hour} horas, ${count} mensagens`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;
