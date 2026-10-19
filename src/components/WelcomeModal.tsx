// Boas-vindas do primeiro acesso: em vez do tour antigo (herdado do sistema
// original, 5 balões na tela WhatsApp), leva direto pra primeira aula da Área
// de Membros. Aparece uma vez por pessoa; quem já respondeu o tour antigo não vê.
import { useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/ds';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';

// Mesma marca do tour antigo: quem já passou por ele não vê a janela de novo.
export const WELCOME_KEY = 'onboarding:welcome';

// "LM Flow no celular" (Introdução ao LM Flow, curso "Como usar o LM Flow").
// Se a aula sumir, a tela do curso abre na primeira aula que a pessoa não viu.
const FIRST_COURSE_ID = '09fcbcd3-205d-464c-97d9-8b50cbd4594b';
const FIRST_LESSON_ID = '4ee1eec2-f72c-4ca1-9e6c-19205c538c96';
export const FIRST_LESSON_PATH = `/academia/curso/${FIRST_COURSE_ID}?lesson=${FIRST_LESSON_ID}`;

export function WelcomeModal() {
  const { t } = useTranslation('tours');
  const navigate = useNavigate();
  const dismissed = useAuthStore(state => !!state.tours[WELCOME_KEY]);
  const markTourCompleted = useAuthStore(state => state.markTourCompleted);
  const markTourSkipped = useAuthStore(state => state.markTourSkipped);

  if (dismissed) return null;

  const handleWatch = () => {
    markTourCompleted(WELCOME_KEY);
    navigate(FIRST_LESSON_PATH);
  };

  // Janela da casa sem X e sem fechar por fora/Esc: só sai por um dos dois botões.
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        className="max-w-md p-8 gap-6 justify-items-center text-center"
      >
        <div
          className="flex items-center justify-center rounded-full w-16 h-16"
          style={{ backgroundColor: '#00C48C' }}
        >
          <PlayCircle className="h-8 w-8 text-white" />
        </div>

        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold">{t('welcome.title')}</DialogTitle>
          <DialogDescription>{t('welcome.description')}</DialogDescription>
          <p className="text-sm text-muted-foreground">{t('welcome.laterHint')}</p>
        </div>

        <DialogFooter className="w-full justify-self-stretch sm:justify-center">
          <Button variant="outline" onClick={() => markTourSkipped(WELCOME_KEY)}>
            {t('welcome.laterButton')}
          </Button>
          <Button onClick={handleWatch} style={{ backgroundColor: '#00C48C', color: '#fff' }}>
            {t('welcome.watchButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
