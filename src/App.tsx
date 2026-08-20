import AppRouter from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { DarkModeProvider } from './contexts/ThemeContext';
import { DemoModeProvider } from './contexts/DemoModeContext';
import ImpersonationBar from './components/ImpersonationBar';
import AppInitializer from './components/AppInitializer';
import { GlobalConfigProvider } from './contexts/GlobalConfigContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { TenantFeaturesProvider } from './contexts/TenantFeaturesContext';
import { UISettingsApplier } from './components/UISettingsApplier';
import ErrorBoundary from './components/ErrorBoundary';

import { Toaster } from '@/components/ui/ds';

import { useIsDarkClass } from '@/hooks/chat/useIsDarkClass';

// Componente wrapper para o Toaster que usa o contexto de tema
function ThemedToaster() {
  const isDark = useIsDarkClass();

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={2000}
      theme={isDark ? 'dark' : 'light'}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DarkModeProvider>
          <DemoModeProvider>
          <GlobalConfigProvider>
            <UISettingsApplier />
            <PermissionsProvider>
              <TenantFeaturesProvider>
                <NotificationsProvider>
                  <AppInitializer>
                    <ImpersonationBar />
                    <AppRouter />
                    <ThemedToaster />
                  </AppInitializer>
                </NotificationsProvider>
              </TenantFeaturesProvider>
            </PermissionsProvider>
          </GlobalConfigProvider>
          </DemoModeProvider>
        </DarkModeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
