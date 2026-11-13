import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ssoEntryService } from '@/services/auth/ssoEntryService';

// Lê o que veio na URL e já tira da barra (histórico), antes de qualquer pedido.
export function lerEntradaDaUrl(): { code: string | null; token: string | null } {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const token = params.get('token');
  if (code || token) window.history.replaceState(null, '', window.location.pathname);
  return { code, token };
}

// Entrada pelo "Entrar" do painel raiz, no endereço do cliente.
//
// Desde 12/11/2026 (auditoria 3E-04) o painel manda /sso?code=<código>: um
// código de uso único, de 60 s, que esta tela troca pelo passe num POST. O
// passe nunca mais vai na URL. `?token=` (o formato antigo) ainda é aceito
// enquanto existir link aberto da versão anterior do painel; sai depois.
export default function SsoEntry() {
  useEffect(() => {
    // O endereço desta página não vai como Referer pra lugar nenhum.
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);

    const { code, token } = lerEntradaDaUrl();
    let ativo = true;

    const entrar = (passe: string | null) => {
      if (!ativo) return;
      if (passe) {
        useAuthStore.getState().setAccessToken(passe); // persiste no localStorage
        window.location.replace('/'); // recarrega limpo — app valida e entra
      } else {
        window.location.replace('/login');
      }
    };

    if (code) {
      ssoEntryService.exchange(code).then(entrar);
    } else {
      entrar(token);
    }

    return () => {
      ativo = false;
      meta.remove();
    };
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
