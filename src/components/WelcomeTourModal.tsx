import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/ds';
import { tourRegistry } from '@/tours/tourRegistry';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';

const TOUR_ROUTE = '/channels';

export function WelcomeTourModal() {
  const { t } = useTranslation('tours');
  const tours = useAuthStore(state => state.tours);
  const markTourCompleted = useAuthStore(state => state.markTourCompleted);
  const markTourSkipped = useAuthStore(state => state.markTourSkipped);

  const [pendingTour, setPendingTour] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissed = !!tours['onboarding:welcome'];

  // Only start the tour after we have navigated to TOUR_ROUTE
  useEffect(() => {
    if (!pendingTour) return;
    if (pathname !== TOUR_ROUTE) return;

    timerRef.current = setTimeout(() => {
      tourRegistry.start(TOUR_ROUTE);
      setPendingTour(false);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingTour, pathname]);

  if (dismissed) return null;

  const handleDismiss = () => {
    markTourSkipped('onboarding:preference');
    markTourCompleted('onboarding:welcome');
  };

  const handleStartTour = () => {
    markTourCompleted('onboarding:preference');
    markTourCompleted('onboarding:welcome');
    navigate(TOUR_ROUTE);
    setPendingTour(true);
  };

  // Janela da casa sem X e sem fechar por fora/Esc: como antes, só sai por um
  // dos dois botões (começar o tour ou pular).
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
          <Map className="h-8 w-8 text-white" />
        </div>

        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold">{t('welcome.title')}</DialogTitle>
          <DialogDescription>
            {t('welcome.description')}
          </DialogDescription>
        </div>

        <DialogFooter className="w-full">
          <Button variant="outline" onClick={handleDismiss}>
            {t('welcome.skipButton')}
          </Button>
          <Button onClick={handleStartTour} style={{ backgroundColor: '#00C48C', color: '#fff' }}>
            {t('welcome.startButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
