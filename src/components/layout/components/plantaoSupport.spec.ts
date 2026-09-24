import { describe, it, expect } from 'vitest';
import { plantaoUnsupportedReason, isIosDevice, PLANTAO_UNSUPPORTED_TEXT } from './plantaoSupport';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_WHATSAPP_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36';
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI} Instagram 350.0.0`;

const env = (userAgent: string, over: Partial<{ maxTouchPoints: number; standalone: boolean; supported: boolean }> = {}) => ({
  userAgent,
  maxTouchPoints: 0,
  standalone: false,
  supported: false,
  ...over,
});

describe('plantaoUnsupportedReason', () => {
  it('com suporte a push não há motivo — o botão normal aparece', () => {
    expect(plantaoUnsupportedReason(env(IPHONE_SAFARI, { supported: true, standalone: true }))).toBeNull();
  });

  it('iPhone no Safari solto pede instalar na Tela de Início', () => {
    expect(plantaoUnsupportedReason(env(IPHONE_SAFARI, { maxTouchPoints: 5 }))).toBe('ios_not_installed');
  });

  it('iPad que se apresenta como Mac também é iOS', () => {
    expect(isIosDevice(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIosDevice(IPAD_AS_MAC, 0)).toBe(false);
    expect(plantaoUnsupportedReason(env(IPAD_AS_MAC, { maxTouchPoints: 5 }))).toBe('ios_not_installed');
  });

  it('navegador de dentro do WhatsApp/Instagram vence o caso iOS: instalar dali não funciona', () => {
    expect(plantaoUnsupportedReason(env(ANDROID_WHATSAPP_WEBVIEW))).toBe('in_app_browser');
    expect(plantaoUnsupportedReason(env(IPHONE_INSTAGRAM, { maxTouchPoints: 5 }))).toBe('in_app_browser');
  });

  it('iOS já instalado e ainda sem suporte cai no genérico, não manda instalar de novo', () => {
    expect(plantaoUnsupportedReason(env(IPHONE_SAFARI, { maxTouchPoints: 5, standalone: true }))).toBe('browser');
  });

  it('todo motivo tem texto', () => {
    for (const r of ['ios_not_installed', 'in_app_browser', 'browser'] as const) {
      expect(PLANTAO_UNSUPPORTED_TEXT[r].title).toBeTruthy();
      expect(PLANTAO_UNSUPPORTED_TEXT[r].body).toBeTruthy();
    }
  });
});
