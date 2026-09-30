import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';

const STORAGE_KEY = 'lmflow.salesAgents.testPhone';

// Guardar/ler o número do próprio dono. Tudo em try/catch: aba anônima, cookie
// bloqueado ou storage cheio não podem derrubar o botão — só fazem ele
// esquecer o número na próxima vez.
function readSavedPhone(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function savePhone(phone: string) {
  try {
    localStorage.setItem(STORAGE_KEY, phone);
  } catch {
    // sem storage disponível — só não lembra da próxima vez, não é motivo pra falhar o envio
  }
}

/**
 * "Mandar pra mim": entrega a mídia (fotos, vídeo, arquivo) no WhatsApp do
 * PRÓPRIO dono, pela mesma rota do lead real — é assim que ele vê exatamente
 * como a mídia chega, sem gastar teste com lead de verdade.
 *
 * Pede o número uma vez só (fica no localStorage do navegador). Depois disso,
 * clicar já manda pro número salvo; "trocar" reabre o campo.
 */
export default function SendToMeButton({
  onSend,
  label = 'Mandar pra mim',
}: {
  onSend: (phone: string) => Promise<string>;
  label?: string;
}) {
  const [savedPhone, setSavedPhone] = useState(() => readSavedPhone());
  // Campo aberto pra digitar/trocar o número. Começa fechado mesmo sem número
  // salvo — o primeiro clique no botão é quem abre, não o render inicial.
  const [opened, setOpened] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (raw: string) => {
    // Enter no campo dispara o mesmo handler do clique — sem esta trava, Enter
    // segurado (ou um segundo Enter enquanto a 1ª chamada ainda está no ar)
    // mandava o teste em dobro.
    if (sending) return;

    const digits = raw.replace(/\D/g, '');
    if (!digits) return;

    setSending(true);
    try {
      const message = await onSend(digits);
      savePhone(digits);
      setSavedPhone(digits);
      setOpened(false);
      setPhoneInput('');
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui mandar o teste agora.');
    } finally {
      setSending(false);
    }
  };

  const handleMainClick = () => {
    if (savedPhone) {
      void send(savedPhone);
    } else {
      setOpened(true);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      {opened ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            placeholder="Seu WhatsApp (com DDD)"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(phoneInput); }}
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            disabled={sending || !phoneInput.trim()}
            onClick={() => void send(phoneInput)}
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enviar'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={sending}
            onClick={handleMainClick}
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {label}
          </Button>
          {savedPhone && (
            <>
              <span>para {savedPhone}</span>
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => { setOpened(true); setPhoneInput(''); }}
              >
                trocar
              </button>
            </>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Não responda essa mensagem pelo seu WhatsApp. A resposta (inclusive a automática do WhatsApp Business)
        entra no CRM como lead.
      </p>
    </div>
  );
}
