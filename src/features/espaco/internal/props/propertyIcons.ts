// LM Notion — icone por tipo de propriedade (usado no header da tabela,
// no PropertyMenu e no painel lateral da pagina).

import {
  Type, AlignLeft, Hash, ChevronDownCircle, List, Loader, Calendar, User,
  Paperclip, CheckSquare, Link, Mail, Phone, Sigma, ArrowUpRight,
  FunctionSquare, Clock, UserPlus, Clock4, UserCog,
  type LucideIcon,
} from 'lucide-react'
import type { PropertyType } from '../types'

export const PROPERTY_ICONS: Record<PropertyType, LucideIcon> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: ChevronDownCircle,
  multi_select: List,
  status: Loader,
  date: Calendar,
  person: User,
  files: Paperclip,
  checkbox: CheckSquare,
  url: Link,
  email: Mail,
  phone: Phone,
  formula: Sigma,
  relation: ArrowUpRight,
  rollup: FunctionSquare,
  created_time: Clock,
  created_by: UserPlus,
  last_edited_time: Clock4,
  last_edited_by: UserCog,
  auto_number: Hash,
}
