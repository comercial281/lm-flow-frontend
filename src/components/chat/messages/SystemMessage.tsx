import React from 'react';
import {
  User,
  Users,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Star,
  ArrowUp,
  ArrowDown,
  Mail,
  MessageCircle,
  Shield,
  Zap,
  Calendar,
  FileText,
  Activity,
  CheckCircle2,
  RotateCw,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { Message } from '@/types/chat/api';
import { formatMessageTime } from '@/utils/time/timeHelpers';
import { etiquetasNaMensagem } from '@/features/conversas/etiquetasNaMensagem';
import { lerEvento, type PilulaDoEvento } from '@/features/conversas/eventoDaConversa';
import CartaoDeEvento from './CartaoDeEvento';
import PilulaDeSistema from './PilulaDeSistema';

interface SystemMessageProps {
  message: Message;
  labels?: Array<{ id: string; title: string; color: string }>;
}

// Mapeamento de ações do sistema para ícones
const getSystemMessageIcon = (content: string): LucideIcon => {
  const lowerContent = content.toLowerCase();

  // Prioridade
  if (lowerContent.includes('priority')) {
    if (lowerContent.includes('high') || lowerContent.includes('urgent')) {
      return ArrowUp;
    } else if (lowerContent.includes('low')) {
      return ArrowDown;
    }
    return AlertCircle;
  }

  // Status da conversa
  if (
    lowerContent.includes('resolved') ||
    lowerContent.includes('resolvida') ||
    lowerContent.includes('pending') ||
    lowerContent.includes('pendente') ||
    lowerContent.includes('reopened') ||
    lowerContent.includes('reaberta') ||
    lowerContent.includes('status')
  ) {
    if (lowerContent.includes('resolved') || lowerContent.includes('resolvida')) {
      return CheckCircle;
    } else if (lowerContent.includes('pending') || lowerContent.includes('pendente')) {
      return Clock;
    } else if (lowerContent.includes('reopened') || lowerContent.includes('reaberta')) {
      return MessageCircle;
    }
    return Activity;
  }

  // Atribuições
  if (
    lowerContent.includes('assigned') ||
    lowerContent.includes('atribuída') ||
    // "Atribuído a X pela Roleta" (masculino) não casava com 'atribuída' e caía
    // no ícone genérico, junto com a linha de intervenção.
    lowerContent.includes('atribuído') ||
    lowerContent.includes('roleta') ||
    lowerContent.includes('respondeu num lead') ||
    lowerContent.includes('replied on a lead') ||
    lowerContent.includes('assignee') ||
    lowerContent.includes('agent') ||
    lowerContent.includes('team') ||
    lowerContent.includes('time')
  ) {
    if (lowerContent.includes('team') || lowerContent.includes('time')) {
      return Users;
    }
    return User;
  }

  // Etiquetas
  if (
    lowerContent.includes('label') ||
    lowerContent.includes('etiqueta') ||
    lowerContent.includes('tag')
  ) {
    return Tag;
  }

  // Avaliação/Rating
  if (lowerContent.includes('rating') || lowerContent.includes('avaliação')) {
    return Star;
  }

  // Configurações/Settings
  if (lowerContent.includes('settings') || lowerContent.includes('configuração')) {
    return Settings;
  }

  // Email/Mensagem
  if (lowerContent.includes('email') || lowerContent.includes('message')) {
    return Mail;
  }

  // Automação/Bot
  if (
    lowerContent.includes('bot') ||
    lowerContent.includes('automation') ||
    lowerContent.includes('automação')
  ) {
    return Zap;
  }

  // Agendamento
  if (lowerContent.includes('scheduled') || lowerContent.includes('agendada')) {
    return Calendar;
  }

  // Nota/Anotação
  if (lowerContent.includes('note') || lowerContent.includes('nota')) {
    return FileText;
  }

  // Segurança/Permissão
  if (
    lowerContent.includes('permission') ||
    lowerContent.includes('security') ||
    lowerContent.includes('permissão')
  ) {
    return Shield;
  }

  // Padrão para mensagens de sistema genéricas
  return Activity;
};

// Linha de sistema da conversa. Evento conhecido (visita, tarefa, negócio) vira
// cartão ou pílula própria; o resto (etiqueta, atribuição, Roleta, status) vira
// pílula com o texto de sempre. Tipo de evento que a tela não conhece cai na
// pílula com a frase completa do servidor.
const ICONES_DA_PILULA: Record<PilulaDoEvento['icone'], LucideIcon> = {
  check: CheckCircle2,
  estrela: Star,
  remarcar: RotateCw,
  robo: Bot,
};

const NOME_E_VERBO = /^(.+) (adicionou|removeu)$/s;

const SystemMessage: React.FC<SystemMessageProps> = ({ message, labels = [] }) => {
  const hora = formatMessageTime(message.created_at);
  const evento = lerEvento(message);

  if (evento && 'cartao' in evento) return <CartaoDeEvento cartao={evento.cartao} hora={hora} />;
  if (evento) {
    const p = evento.pilula;
    return (
      <PilulaDeSistema icone={ICONES_DA_PILULA[p.icone]} nome={p.nome} texto={p.texto} estrelas={p.estrelas} hora={hora} />
    );
  }

  // Etiquetas citadas no texto (id ou título inteiro): viram etiqueta colorida.
  // Linha de etiqueta leva sempre o ícone de etiqueta ("visita-agendada" puxava a agenda).
  const { texto, etiquetas } = etiquetasNaMensagem(message.content, labels);
  const nomeEVerbo = etiquetas.length ? NOME_E_VERBO.exec(texto) : null;

  return (
    <PilulaDeSistema
      icone={etiquetas.length ? Tag : getSystemMessageIcon(message.content)}
      nome={nomeEVerbo?.[1]}
      texto={nomeEVerbo ? nomeEVerbo[2] : texto}
      etiquetas={etiquetas}
      etiquetasRiscadas={nomeEVerbo?.[2] === 'removeu'}
      hora={hora}
    />
  );
};

export default SystemMessage;
