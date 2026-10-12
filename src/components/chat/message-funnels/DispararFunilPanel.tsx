import { Card, CardContent } from '@evoapi/design-system/card';
import { MensagensProntas } from './MensagensProntas';

// MENSAGENS PRONTAS em JANELA, em cima do campo de mensagem: no celular (lá não
// há lateral) e na aba Conversa do card do lead. No computador, em Conversas,
// elas abrem na lateral, no lugar do painel do lead (`ContactSidebar`). O
// conteúdo é o mesmo (`MensagensProntas`); aqui a janela fecha depois de
// enviar, porque cobre a conversa.

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | number | null;
  /** Depois de enviar: relê a faixa "automação rodando". */
  onStarted?: () => void;
}

export function DispararFunilPanel({ isOpen, onClose, conversationId, onStarted }: Props) {
  if (!isOpen) return null;

  return (
    <Card
      className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      role="dialog"
      aria-label="Mensagens prontas"
      data-testid="painel-disparar-funil"
    >
      <CardContent className="p-0 flex flex-col max-h-[min(70vh,32rem)]">
        <MensagensProntas
          ativo={isOpen}
          onde="janela"
          conversationId={conversationId}
          onStarted={onStarted}
          aoFechar={onClose}
        />
      </CardContent>
    </Card>
  );
}
