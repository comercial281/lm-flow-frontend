// DashNotion — barra de acoes do card. Duplicata adaptada de
// _internal/views/CardActions.tsx. Agora que a edge share-notion tem
// timer/completed_at, o cronometro (play/pause + tempo ao vivo) e o
// Finalizar/Reabrir (toggle_done + move a coluna) voltaram, iguais ao CRM.

import { useEffect, useState } from 'react'
import { Play, Pause, CheckCircle2, Archive, Trash2 } from 'lucide-react'
import type { PageRow, NotionProperty } from '@/features/espaco/internal/types'
import { opcaoDeConclusao } from '@/features/espaco/internal/types'
import {
  useToggleTimer, useToggleFinalizada, useArchivePage, useDeletePageForever,
  tempoTotalSegundos, formatarTempo,
} from '../useDashNotion'

interface CardActionsProps {
  row: PageRow
  databaseId: string
  properties: NotionProperty[]
  /** Passe quando o container ja sabe (quadro): evita recalcular pela propriedade. */
  finalizadaHint?: boolean
}

export default function CardActions({ row, databaseId, properties, finalizadaHint }: CardActionsProps) {
  const toggleTimer = useToggleTimer()
  const toggleFinal = useToggleFinalizada()
  const arquivar = useArchivePage()
  const excluir = useDeletePageForever()

  const rodando = !!row.timer_started_at
  // Re-render de 1 em 1s so enquanto o cronometro esta rodando.
  const [, forcar] = useState(0)
  useEffect(() => {
    if (!rodando) return
    const t = setInterval(() => forcar(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [rodando])

  // Exclusao pede 2 cliques; volta ao normal sozinha se o usuario desistir.
  const [confirmando, setConfirmando] = useState(false)
  useEffect(() => {
    if (!confirmando) return
    const t = setTimeout(() => setConfirmando(false), 4000)
    return () => clearTimeout(t)
  }, [confirmando])

  const propConclusao = properties.find(p => opcaoDeConclusao(p)) ?? null
  const done = opcaoDeConclusao(propConclusao)
  const finalizada = finalizadaHint
    ?? (!!done && !!propConclusao && row.props[propConclusao.id] === done.id)
  const voltarPara = propConclusao?.config?.options?.find(o => o.id !== done?.id) ?? null
  const total = tempoTotalSegundos(row)

  // O card inteiro costuma ser clicavel; estas acoes nao podem abrir a pagina.
  const semPropagar = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    fn()
  }

  return (
    <div className="mt-1.5 flex items-center gap-0.5 border-t border-lm-border/60 pt-1.5">
      <button
        type="button"
        aria-label={rodando ? 'Parar cronometro' : 'Iniciar cronometro'}
        title={rodando ? 'Parar cronometro' : 'Iniciar cronometro'}
        onClick={semPropagar(() => toggleTimer.mutate({ page: row, database_id: databaseId }))}
        className={`flex items-center gap-1 rounded-lm-sm px-1 py-0.5 text-[11px] transition-colors ${
          rodando ? 'text-lm-success hover:bg-lm-card2' : 'text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary'
        }`}
      >
        {rodando ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {total > 0 && <span className="tabular-nums">{formatarTempo(total)}</span>}
      </button>

      <span className="ml-auto flex items-center gap-0.5">
        {done && propConclusao && (
          <button
            type="button"
            aria-label={finalizada ? 'Reabrir tarefa' : 'Finalizar tarefa'}
            title={finalizada ? 'Reabrir tarefa' : 'Finalizar tarefa'}
            onClick={semPropagar(() => toggleFinal.mutate({
              page: row,
              database_id: databaseId,
              property_id: propConclusao.id,
              doneOptionId: done.id,
              voltarParaOptionId: voltarPara?.id ?? null,
              finalizar: !finalizada,
            }))}
            className={`flex items-center gap-1 rounded-lm-sm px-1 py-0.5 text-[11px] transition-colors ${
              finalizada
                ? 'text-lm-success hover:bg-lm-card2'
                : 'text-lm-subtle hover:bg-lm-card2 hover:text-lm-success'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {finalizada ? 'Reabrir' : 'Finalizar'}
          </button>
        )}

        {/* Arquivar: vai pra lixeira e da pra restaurar depois. */}
        <button
          type="button"
          aria-label="Arquivar tarefa"
          title="Arquivar (vai pra lixeira, da pra restaurar)"
          onClick={semPropagar(() => arquivar.mutate({ id: row.id, database_id: databaseId }))}
          className="rounded-lm-sm p-1 text-lm-subtle transition-colors hover:bg-lm-card2 hover:text-lm-primary"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>

        {/* Excluir e definitivo: confirma em DOIS cliques, inline. */}
        {confirmando ? (
          <button
            type="button"
            aria-label="Confirmar exclusao"
            title="Clique de novo pra excluir de vez"
            onClick={semPropagar(() => excluir.mutate(row.id))}
            className="flex items-center gap-1 rounded-lm-sm bg-lm-danger px-1.5 py-0.5 text-[11px] text-lm-inverse"
          >
            <Trash2 className="h-3 w-3" />
            Confirmar?
          </button>
        ) : (
          <button
            type="button"
            aria-label="Excluir tarefa"
            title="Excluir definitivamente"
            onClick={semPropagar(() => setConfirmando(true))}
            className="rounded-lm-sm p-1 text-lm-subtle transition-colors hover:bg-lm-card2 hover:text-lm-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  )
}
