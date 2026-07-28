// DashNotion — view de galeria. Duplicata de _internal/views/GalleryView.tsx
// com PropCell/CardActions do dash.

import { useMemo } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { PageRow, NotionProperty, NotionView } from '@/features/espaco/internal/types'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import { resolveCellValue, isVazio, propriedadesVisiveis } from '@/features/espaco/internal/views/viewLib'
import PropCell from '../props/PropCell'
import CardActions from './CardActions'

interface GalleryViewProps {
  rows: PageRow[]
  properties: NotionProperty[]
  view: NotionView
  databaseId: string
  onOpenPage: (pageId: string) => void
}

const GRID_BY_SIZE: Record<'small' | 'medium' | 'large', string> = {
  small:  'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  large:  'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
}

const COVER_HEIGHT: Record<'small' | 'medium' | 'large', string> = {
  small: 'h-24', medium: 'h-36', large: 'h-52',
}

export default function GalleryView({ rows, properties, view, databaseId, onOpenPage }: GalleryViewProps) {
  const size = view.config?.card_size ?? 'medium'
  const fit = view.config?.fit_cover ?? true

  const coverProp = useMemo(
    () => properties.find(p => p.id === view.config?.cover_property_id) ?? null,
    [properties, view.config?.cover_property_id],
  )

  const cardProps = useMemo(
    () => propriedadesVisiveis(properties, view).filter(p => p.type !== 'title'),
    [properties, view],
  )

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-14">
        <p className="text-sm text-lm-subtle">Nenhum item para exibir nesta galeria.</p>
      </div>
    )
  }

  return (
    <div className={`grid h-full content-start gap-3 overflow-y-auto p-3 ${GRID_BY_SIZE[size]}`}>
      {rows.map(row => {
        const cover = coverUrl(row, coverProp)
        return (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenPage(row.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpenPage(row.id) }}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-lm-lg border border-lm-border bg-lm-card text-left transition-colors hover:border-lm-neon"
          >
            <div className={`flex w-full items-center justify-center bg-lm-bg ${COVER_HEIGHT[size]}`}>
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className={`h-full w-full ${fit ? 'object-cover' : 'object-contain'}`}
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-lm-disabled" />
              )}
            </div>

            <div className="flex flex-col gap-1.5 p-2.5">
              <span className="line-clamp-2 text-sm text-lm-primary group-hover:text-lm-neon">
                {row.title || 'Sem titulo'}
              </span>
              {cardProps.map(property => {
                const valor = resolveCellValue(row, property, properties)
                if (isVazio(valor)) return null
                const Icon = PROPERTY_ICONS[property.type]
                return (
                  <span key={property.id} className="flex items-center gap-1.5 min-w-0">
                    <Icon className="h-3 w-3 shrink-0 text-lm-disabled" />
                    <span className="min-w-0 truncate text-xs text-lm-subtle">
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

              <CardActions row={row} databaseId={databaseId} properties={properties} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function coverUrl(row: PageRow, coverProp: NotionProperty | null): string | null {
  if (row.cover_url) return row.cover_url
  if (!coverProp) return null

  const value = row.props[coverProp.id]
  if (typeof value === 'string' && value.startsWith('http')) return value
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && 'url' in item) {
        const url = (item as { url: string }).url
        if (typeof url === 'string') return url
      }
      if (typeof item === 'string' && item.startsWith('http')) return item
    }
  }
  return null
}
