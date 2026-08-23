import React, { Suspense, useRef, useEffect } from 'react';
import type { EmojiClickData, Theme } from 'emoji-picker-react';
import { useLanguage } from '@/hooks/useLanguage';
import { useIsDarkClass } from '@/hooks/chat/useIsDarkClass';
import { lazyWithRetry } from '@/utils/chunkReload';

const EmojiPickerReact = lazyWithRetry(() =>
  import('emoji-picker-react').then((m) => ({ default: m.default })),
);

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose, isOpen }) => {
  const { t } = useLanguage('chat');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Verificar a classe dark diretamente no HTML
  const isDark = useIsDarkClass();

  // Converter tema do sistema para o tema do EmojiPicker
  // (valores 'dark'/'light' espelham o enum Theme da lib, sem importá-la em runtime)
  const emojiTheme = (isDark ? 'dark' : 'light') as Theme;

  // Fechar o picker ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Adicionar evento após um pequeno delay para evitar fechar imediatamente
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    // Não fechar automaticamente para permitir múltiplas seleções
    // onClose();
  };

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 z-[9999]"
      style={{
        minWidth: '350px',
        maxWidth: '350px',
      }}
    >
      <div className="bg-background border-2 border-border rounded-lg shadow-2xl overflow-hidden">
        <Suspense fallback={null}>
          <EmojiPickerReact
            onEmojiClick={handleEmojiClick}
            theme={emojiTheme}
            searchPlaceHolder={t('messageInput.emojiPicker.searchPlaceholder')}
            width="350px"
            height="400px"
            previewConfig={{
              showPreview: false,
            }}
            skinTonesDisabled={false}
            searchDisabled={false}
            lazyLoadEmojis={true}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default EmojiPicker;
