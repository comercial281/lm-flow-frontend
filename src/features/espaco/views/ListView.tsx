// DashNotion — view de lista. Duplicata de _internal/views/ListView.tsx
// com PropCell/CardActions do dash.

import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import type { PageRow, NotionProperty, NotionView } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import { resolveCellValue, isVazio, propriedadesVisiveis } from '@/features/espaco/internal/views/viewLib'
import PropCell from '../props/PropCell'
import CardActions from './CardActions'

interface ListViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  databaseId: string
  onOpenPage: (pageId: string) => void
}

export default function ListView({ rows, properties, view, databaseId, onOpenPage }: ListViewProps) {
  const listProps = useMemo(
    () => propriedadesVisiveis(properties, view).filter(p => p.type !== 'title').slice(0, 4),
    [properties, view],
  )

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-14">
        <p className="text-sm text-lm-subtle">Nenhum item para exibir nesta lista.</p>
      </div>
    )
  }

  return (
    <ul className="h-full overflow-y-auto py-1">
      {rows.map(row => (
        <li key={row.id}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpenPage(row.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpenPage(row.id) }}
            className="group flex w-full cursor-pointer items-center gap-2 border-b border-lm-border px-3 py-2 text-left hover:bg-lm-card2"
          >
            <span className="shrink-0 text-lm-subtle">
              {row.icon
                ? <span className="text-sm leading-none">{row.icon}</span>
                : <FileText className="h-4 w-4" />}
            </span>

            <span className="truncate text-sm text-lm-primary group-hover:text-lm-neon">
              {row.title || 'Sem titulo'}
            </span>

            <span className="ml-auto flex shrink-0 items-center gap-3 pl-3">
              {listProps.map(property => {
                const valor = resolveCellValue(row, property, properties)
                if (isVazio(valor)) return null
                const Icon = PROPERTY_ICONS[property.type]
                return (
                  <span key={property.id} className="hidden items-center gap-1 sm:flex">
                    <Icon className="h-3 w-3 text-lm-disabled" />
                    <span className="max-w-[160px] truncate text-xs text-lm-subtle">
                      <PropCell
                        property={property}
                        value={valor}
                        pageId={row.id}
                        databaseId={row.database_id ?? ''}
                        relations={row.relations[property.id]}
                        onChange={() => {}}
                        variant="card"
                      />
                    </span>
                  </span>
                )
              })}
            </span>

            <span className="ml-2 shrink-0 [&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0">
              <CardActions row={row} databaseId={databaseId} properties={properties} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
