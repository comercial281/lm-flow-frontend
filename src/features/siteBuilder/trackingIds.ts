// Mesmas regras do servidor (Site#normalize_tracking_ids): a tela avisa antes de salvar.
export const normalizarGa4 = (v: string) => v.trim().toUpperCase();
export const normalizarPixel = (v: string) => v.replace(/\s+/g, '');
export const normalizarGtm = (v: string) => v.trim().toUpperCase();

export function erroGa4(v: string): string | null {
  const n = normalizarGa4(v);
  return !n || /^G-[A-Z0-9]{4,20}$/.test(n) ? null : 'O código começa com G- (ex.: G-AB12CD34EF).';
}
export function erroPixel(v: string): string | null {
  const n = normalizarPixel(v);
  return !n || /^\d{6,20}$/.test(n) ? null : 'O número do pixel tem só números (ex.: 123456789012345).';
}
export function erroGtm(v: string): string | null {
  const n = normalizarGtm(v);
  return !n || /^GTM-[A-Z0-9]{4,12}$/.test(n) ? null : 'O código começa com GTM- (ex.: GTM-AB12CD).';
}
