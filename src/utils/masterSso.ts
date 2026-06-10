// Master-admin SSO landing.
//
// When the master admin opens a client's CRM from the root "Clientes CRM" panel,
// the client URL carries `#master_sso=<base64(encodeURIComponent(JSON{token,name,root}))>`.
// We consume it BEFORE the app boots: store the token (so authStore logs in as the
// super-admin on this tenant) and mark the master session (so the red bar shows).
// The hash is always stripped so the token never lingers in the URL/history.
export function consumeMasterSso(): void {
  try {
    const m = (window.location.hash || '').match(/master_sso=([^&]+)/);
    if (!m) return;
    const decoded = JSON.parse(decodeURIComponent(atob(m[1])));
    if (decoded?.token) {
      localStorage.setItem('access_token', decoded.token);
      if (decoded.name) sessionStorage.setItem('lm_master_client', String(decoded.name));
      if (decoded.root) sessionStorage.setItem('lm_master_root', String(decoded.root));
    }
  } catch (e) {
    console.error('[master_sso] failed to parse landing payload', e);
  } finally {
    if ((window.location.hash || '').includes('master_sso')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

// Builds the URL to open a client's CRM already logged in as the master admin.
export function buildMasterSsoUrl(frontendUrl: string, token: string, name: string): string {
  const payload = btoa(encodeURIComponent(JSON.stringify({ token, name, root: window.location.origin })));
  const base = frontendUrl.replace(/\/+$/, '');
  return `${base}/#master_sso=${payload}`;
}
