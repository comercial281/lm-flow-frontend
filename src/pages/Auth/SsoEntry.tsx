import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

// Entrada SSO: o super-admin abre /sso?token=<token> (gerado pelo painel raiz)
// no subdomínio do cliente. Guarda o token, limpa a URL e recarrega logado.
export default function SsoEntry() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      useAuthStore.getState().setAccessToken(token); // persiste no localStorage
      window.location.replace('/'); // recarrega limpo (tira o token da URL) — app valida e entra
    } else {
      window.location.replace('/login');
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F0520', color: 'rgba(255,255,255,0.7)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#a855f7', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
        Entrando…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
