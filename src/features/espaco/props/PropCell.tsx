// DashNotion — dispatcher de celula de propriedade. Duplicata de
// _internal/props/PropCell.tsx: editores PUROS vem do CRM por import direto;
// os acoplados a dados (Select/MultiSelect/Person/Files/Relation/Readonly) sao
// as versoes do dash.

import { READONLY_TYPES, type NotionProperty, type PropertyValue } from '@/features/espaco/internal/types'
import TextCell from '@/features/espaco/internal/props/editors/TextCell'
import NumberCell from '@/features/espaco/internal/props/editors/NumberCell'
import DateCell from '@/features/espaco/internal/props/editors/DateCell'
import CheckboxCell from '@/features/espaco/internal/props/editors/CheckboxCell'
import SelectCell from './SelectCell'
import MultiSelectCell from './MultiSelectCell'
import PersonCell from './PersonCell'
import FilesCell from './FilesCell'
import RelationCell from './RelationCell'
import ReadonlyCell from './ReadonlyCell'

interface PropCellProps {
  property: NotionProperty
  value: PropertyValue
  pageId: string
  databaseId: string
  relations?: string[]
  onChange: (v: PropertyValue) => void
  onRelationChange?: (pageIds: string[]) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

export default function PropCell({
  property, value, relations = [], onChange, onRelationChange,
  variant = 'table', autoFocus,
}: PropCellProps) {
  const { type, config } = property

  if (READONLY_TYPES.includes(type)) {
    return <ReadonlyCell type={type} computed={value} variant={variant} />
  }

  const readOnly = variant === 'card'

  switch (type) {
    case 'title':
    case 'text':
    case 'url':
    case 'email':
    case 'phone':
      return <TextCell type={type} value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'number':
      return <NumberCell config={config ?? {}} value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'select':
    case 'status':
      return <SelectCell property={property} value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'multi_select':
      return <MultiSelectCell property={property} value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'date':
      return <DateCell config={config ?? {}} value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'person':
      return <PersonCell value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'checkbox':
      return <CheckboxCell value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'files':
      return <FilesCell value={value} onChange={onChange} variant={variant} autoFocus={autoFocus} />

    case 'relation':
      return (
        <RelationCell
          config={config ?? {}}
          relations={relations}
          onRelationChange={readOnly ? () => {} : (onRelationChange ?? (() => {}))}
          variant={variant}
          autoFocus={autoFocus}
        />
      )

    default:
      return <span className="block px-2 py-1 text-sm text-lm-subtle">Tipo nao suportado</span>
  }
}
