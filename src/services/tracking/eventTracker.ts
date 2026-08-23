// Rastreador global de UI do LM Flow.
// Captura cada clique, cada navegação e o tempo gasto em cada tela, e envia em
// lote pro backend (POST /api/v1/tracking/events) + heartbeat de sessão. Tudo
// resiliente: nunca quebra a navegação do usuário. Alimenta a aba "Métricas de
// Uso" do super-admin.
import api from '@/services/core/api';

type UiKind = 'navigation' | 'click' | 'screen_time' | 'heartbeat';

interface UiEvent {
  kind: UiKind;
  path?: string;
  screen?: string;
  element_label?: string;
  element_selector?: string;
  duration_ms?: number;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

const FLUSH_INTERVAL = 15_000;     // envia o lote a cada 15s
const HEARTBEAT_INTERVAL = 60_000; // mantém a sessão viva a cada 60s
const MAX_QUEUE = 400;

// Mapa de rota -> nome amigável da tela (prefixo). Ordem importa (mais específico primeiro).
const SCREEN_MAP: Array<[RegExp, string]> = [
  [/^\/conversations/, 'Conversas / Chat'],
  [/^\/board|^\/pipeline|^\/kanban/, 'Board / Funil'],
  [/^\/contacts/, 'Contatos'],
  [/^\/leads/, 'Leads'],
  [/^\/reports|^\/dashboard/, 'Relatórios'],
  [/^\/automations|^\/automacoes/, 'Automações'],
  [/^\/campaigns|^\/broadcast/, 'Disparos'],
  [/^\/visits|^\/agenda/, 'Agenda de Visitas'],
  [/^\/settings|^\/config/, 'Configurações'],
  [/^\/channels|^\/inboxes/, 'Canais'],
  [/^\/super-admin\/clients/, 'Super: Clientes'],
  [/^\/super-admin\/monitoring/, 'Super: Monitoramento'],
  [/^\/super-admin/, 'Super Admin'],
  [/^\/login/, 'Login'],
];

function screenForPath(path: string): string {
  for (const [re, label] of SCREEN_MAP) if (re.test(path)) return label;
  return path.split('/').filter(Boolean)[0] || 'Início';
}

function elementInfo(el: HTMLElement | null): { label?: string; selector?: string } {
  if (!el) return {};
  const target = (el.closest('[data-track],button,a,[role="button"],input,select,textarea') as HTMLElement) || el;
  const label =
    target.getAttribute?.('data-track') ||
    target.getAttribute?.('aria-label') ||
    target.getAttribute?.('title') ||
    (target.innerText || target.textContent || '').trim().slice(0, 80) ||
    target.getAttribute?.('placeholder') ||
    target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : '';
  const cls = typeof target.className === 'string' && target.className
    ? `.${target.className.split(/\s+/).slice(0, 2).join('.')}`
    : '';
  const selector = `${target.tagName.toLowerCase()}${id}${cls}`.slice(0, 200);
  return { label: (label || '').toString().slice(0, 200), selector };
}

class EventTracker {
  private queue: UiEvent[] = [];
  private running = false;
  private currentScreen = '';
  private currentPath = '';
  private screenEnteredAt = 0;
  private flushTimer?: number;
  private heartbeatTimer?: number;
  private clickHandler?: (e: MouseEvent) => void;
  private visibilityHandler?: () => void;
  private pageHideHandler?: () => void;

  start(initialPath: string) {
    if (this.running) return;
    this.running = true;

    this.clickHandler = (e: MouseEvent) => this.onClick(e);
    document.addEventListener('click', this.clickHandler, { capture: true, passive: true });

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') this.flush();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.pageHideHandler = () => this.flushBeacon();
    window.addEventListener('pagehide', this.pageHideHandler);

    this.flushTimer = window.setInterval(() => this.flush(), FLUSH_INTERVAL);
    this.heartbeatTimer = window.setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL);

    this.onRouteChange(initialPath);
    this.heartbeat();
  }

  stop() {
    if (!this.running) return;
    this.closeScreen();
    this.flush();
    this.running = false;

    if (this.clickHandler) document.removeEventListener('click', this.clickHandler, { capture: true } as EventListenerOptions);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.pageHideHandler) window.removeEventListener('pagehide', this.pageHideHandler);
    if (this.flushTimer) window.clearInterval(this.flushTimer);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.currentScreen = '';
    this.currentPath = '';
  }

  onRouteChange(path: string) {
    if (!this.running || path === this.currentPath) return;
    this.closeScreen();

    this.currentPath = path;
    this.currentScreen = screenForPath(path);
    this.screenEnteredAt = Date.now();
    this.push({ kind: 'navigation', path, screen: this.currentScreen, occurred_at: new Date().toISOString() });
  }

  private closeScreen() {
    if (!this.currentScreen || !this.screenEnteredAt) return;
    const duration = Date.now() - this.screenEnteredAt;
    if (duration > 800) {
      this.push({
        kind: 'screen_time',
        screen: this.currentScreen,
        path: this.currentPath,
        duration_ms: duration,
        occurred_at: new Date().toISOString(),
      });
    }
    this.screenEnteredAt = 0;
  }

  private onClick(e: MouseEvent) {
    const info = elementInfo(e.target as HTMLElement);
    this.push({
      kind: 'click',
      screen: this.currentScreen,
      path: this.currentPath,
      element_label: info.label,
      element_selector: info.selector,
      occurred_at: new Date().toISOString(),
    });
  }

  private push(ev: UiEvent) {
    this.queue.push(ev);
    if (this.queue.length >= MAX_QUEUE) this.flush();
  }

  private async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await api.post('/tracking/events', { events: batch });
    } catch {
      // re-enfileira (até o cap) pra não perder em falha de rede transitória
      if (this.queue.length < MAX_QUEUE) this.queue.unshift(...batch.slice(-100));
    }
  }

  // Envio confiável no fechamento da aba (fetch keepalive, com Authorization).
  private flushBeacon() {
    this.closeScreen();
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      fetch(`${import.meta.env.VITE_API_URL}/api/v1/tracking/events`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ events: batch }),
      }).catch(() => {});
    } catch {
      // noop
    }
  }

  private async heartbeat() {
    if (!this.running) return;
    try {
      await api.post('/tracking/heartbeat', { path: this.currentPath, screen: this.currentScreen });
    } catch {
      // noop
    }
  }
}

export const eventTracker = new EventTracker();
