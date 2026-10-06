import type { NumberSituation } from '@/services/superAdmin/numberOwnershipService';
import { Pill } from './Pill';
import { textoDaSituacao, tomDaSituacao } from './situacao';

// O selo da situação de um número de WhatsApp (entrega 4), com os textos da
// tabela da spec. Não é o ChannelConnectionBadge do app do cliente: aquele só
// conhece três estados e fala pelas chaves de tradução de Canais (o
// conferir-i18n não aceita chave nova).
export default function SeloDaSituacao({
  situacao, desde, agora,
}: {
  situacao: NumberSituation;
  /** ISO de quando caiu; só vale no `disconnected`. */
  desde?: string | null;
  agora?: Date;
}) {
  return <Pill tone={tomDaSituacao(situacao)}>{textoDaSituacao(situacao, desde, agora)}</Pill>;
}
