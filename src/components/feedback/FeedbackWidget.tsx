import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Textarea,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { MessageSquarePlus, Lightbulb, Bug } from 'lucide-react';
import { feedbackService, type FeedbackKind } from '@/services/feedback/feedbackService';
import { FEEDBACK_OPEN_EVENT } from './openFeedback';

/** Rotas do chat (/conversations e /conversations/:id). */
const CHAT_ROUTE = /^\/conversations(\/|$)/;

/**
 * Botão flutuante de "Sugestões/Bugs" para o cliente.
 *
 * Aparece em todas as telas do CRM (montado no MainLayout). O cliente escolhe
 * Sugestão ou Bug, escreve a mensagem e envia — cai na aba "Sugestões/Bugs" do
 * admin (Leal Mídia) e dispara um e-mail de aviso. Sem anexo nesta versão.
 *
 * Exceção: na aba de Conversas o botão flutuante não é renderizado. Ele é
 * `fixed bottom-4 right-4` e caía exatamente em cima do botão de enviar do
 * MessageInput, bloqueando o envio da mensagem. Qualquer reposicionamento ali
 * cobriria outra coisa (a última mensagem ou a lista de conversas), porque o
 * chat ocupa a tela inteira. Nessa tela o acesso continua pelo menu do perfil,
 * que dispara FEEDBACK_OPEN_EVENT e abre o mesmo diálogo.
 */
export default function FeedbackWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('suggestion');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Abre o diálogo quando alguém chama openFeedbackDialog() (menu do perfil).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen);
  }, []);

  const hideFloatingButton = CHAT_ROUTE.test(location.pathname);

  const reset = () => {
    setKind('suggestion');
    setMessage('');
  };

  const handleSubmit = async () => {
    const text = message.trim();
    if (!text) {
      toast.error('Escreva sua mensagem antes de enviar.');
      return;
    }
    setSubmitting(true);
    try {
      await feedbackService.submit({
        kind,
        message: text,
        page_url: location.pathname,
      });
      toast.success('Recebemos seu feedback. Obrigado!');
      setOpen(false);
      reset();
    } catch {
      toast.error('Não consegui enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const KindButton = ({
    value,
    label,
    icon: Icon,
  }: {
    value: FeedbackKind;
    label: string;
    icon: typeof Lightbulb;
  }) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        kind === value
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-input text-muted-foreground hover:bg-accent'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <>
      {!hideFloatingButton && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 gap-2 rounded-full shadow-lg"
          aria-label="Enviar sugestão ou reportar bug"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Sugestões/Bugs</span>
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={o => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-lg font-semibold">Sugestões e Bugs</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Viu algo que pode melhorar ou um problema? Conta pra gente que a equipe recebe direto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <KindButton value="suggestion" label="Sugestão" icon={Lightbulb} />
              <KindButton value="bug" label="Bug" icon={Bug} />
            </div>

            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                kind === 'bug'
                  ? 'Descreva o que aconteceu e onde (quanto mais detalhe, melhor).'
                  : 'Descreva sua sugestão de melhoria.'
              }
              rows={5}
              maxLength={4000}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
