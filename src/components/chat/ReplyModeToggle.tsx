import { MessageSquareIcon } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import { ReplyMode } from '@/types/chat/api';
import { useLanguage } from '@/hooks/useLanguage';

interface ReplyModeToggleProps {
  currentMode: ReplyMode;
  onModeChange: (mode: ReplyMode) => void;
  disabled?: boolean;
  forcedMode?: ReplyMode;
}

// Nota Privada (o modo NOTE) saiu da UI — o Giovani achou a função confusa e
// não confiava que ela realmente segurava a mensagem sem mandar pro cliente
// (19/08). O enum e o envio com isPrivate=true continuam existindo por baixo
// porque uma conversa PENDENTE (sem dono, modo Leilão) ainda precisa desse
// mecanismo: enquanto ninguém assume o lead, o botão fica desabilitado e a
// mensagem nunca vai pro WhatsApp do cliente — só que agora sem expor "nota
// privada" como opção manual pro atendente escolher.
export const ReplyModeToggle = ({
  currentMode,
  onModeChange,
  disabled = false,
  forcedMode,
}: ReplyModeToggleProps) => {
  const { t } = useLanguage('chat');
  const effectiveMode = forcedMode || currentMode;
  const isReplyMode = effectiveMode === ReplyMode.REPLY;
  const isNoteMode = effectiveMode === ReplyMode.NOTE;

  return (
    <div className="flex items-center justify-start shrink-0">
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border w-fit">
        <Button
          variant={isReplyMode ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onModeChange(ReplyMode.REPLY)}
          disabled={disabled || (forcedMode && forcedMode !== ReplyMode.REPLY)}
          className={`
            h-7 px-3 text-xs font-medium transition-all duration-200 flex items-center gap-1.5
            ${
              isReplyMode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }
            ${forcedMode && forcedMode !== ReplyMode.REPLY ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <MessageSquareIcon className="h-3 w-3" />
          {t('replyModeToggle.reply')}
        </Button>
      </div>

      {/* Conversa pendente: explica por que o botão acima está desabilitado. */}
      {isNoteMode && (
        <div className="ml-3 hidden md:flex items-center text-xs text-muted-foreground">
          <span className="font-medium">{t('replyModeToggle.pendingExplainer')}</span>
        </div>
      )}
    </div>
  );
};

export default ReplyModeToggle;
