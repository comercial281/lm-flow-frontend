import { dataHora, plural } from '@/lib/formato';
import type { KitDelivery } from '@/services/superAdmin/welcomeKitService';

// Regras do kit de boas-vindas (aba Plataforma → Kit de boas-vindas e bloco em
// Clientes → Funções). Fora do JSX: as telas do painel raiz já são grandes.

export const MAX_IMAGENS = 6;
export const MAX_LEGENDA = 300;
export const INTERVALO_MS = 3000;
const VIDEO_MAX = 16 * 1024 * 1024;
const IMAGEM_MAX = 5 * 1024 * 1024;
const ESPERA_MAX_MS = 10 * 60 * 1000;
const EXEMPLO = { nome: 'Imobiliária Exemplo', link: 'https://cliente.lmflow.com.br' };

type Arquivo = { type: string; size: number; name: string };

export function problemaNoVideo(f: Arquivo): string | null {
  if (f.type !== 'video/mp4' && !/\.mp4$/i.test(f.name)) return 'Envie o vídeo em MP4.';
  if (f.size > VIDEO_MAX) return 'O vídeo passa de 16 MB, o limite do WhatsApp.';
  return null;
}

export function problemaNaImagem(f: Arquivo): string | null {
  if (!['image/jpeg', 'image/png'].includes(f.type)) return 'Envie a imagem em JPG ou PNG.';
  if (f.size > IMAGEM_MAX) return 'A imagem passa de 5 MB.';
  return null;
}

export function moverImagem<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function textoUltimoEnvio(d: KitDelivery | null): string {
  if (!d) return 'Ainda não enviado.';
  const total = d.total ?? d.items.length;
  const sent = d.sent ?? d.items.filter(i => i.status === 'sent').length;
  // Falha é o que tentou e não foi. O que nem chegou a sair (envio interrompido)
  // aparece separado: chamar de falha mandaria procurar defeito na peça.
  const falhas = d.items.filter(i => i.status === 'failed').length;
  const naoSairam = d.items.filter(i => i.status === 'queued').length;
  const quando = dataHora(d.finished_at || d.started_at);
  const abertura = d.state === 'interrupted'
    ? `Envio interrompido em ${quando}`
    : sent === 0 ? `Tentativa em ${quando}` : `Enviado em ${quando}`;
  let texto = `${abertura} por ${d.by} · ${sent} de ${plural(total, 'peça', 'peças')}`;
  if (falhas > 0) texto += ` · ${falhas} ${falhas === 1 ? 'falhou' : 'falharam'}`;
  if (naoSairam > 0) texto += ` · ${naoSairam} ${naoSairam === 1 ? 'não saiu' : 'não saíram'}`;
  return texto;
}

export function textoAndamento(p: KitDelivery): string {
  const total = p.items.length;
  const feitas = p.items.filter(i => i.status !== 'queued').length;
  return `Enviando ${Math.min(feitas + 1, total)} de ${total}…`;
}

export function rotuloDoBotao(n: number): string {
  return `Enviar no grupo (${plural(n, 'peça', 'peças')})`;
}

/** A prévia da aba Plataforma: o texto com um cliente de exemplo no lugar dos trechos. */
export function previaDoTexto(template: string): string {
  return Object.entries(EXEMPLO).reduce(
    (t, [k, v]) => t.split(`{{${k}}}`).join(v).split(`{${k}}`).join(v),
    template,
  ).trim();
}

// Os dois formatos de erro da API: `{ error: 'texto' }` (painel raiz) e
// `{ error: { message } }` (recusa por cargo). Ler só um faz a recusa virar
// frase genérica.
export function motivo(e: unknown, reserva: string): string {
  const r = (e as { response?: { data?: { error?: unknown; message?: string } } })?.response?.data;
  if (typeof r?.error === 'string' && r.error) return r.error;
  const m = (r?.error as { message?: string } | undefined)?.message;
  return m || r?.message || reserva;
}

export function esperaEstourou(inicioMs: number, agoraMs: number): boolean {
  return agoraMs - inicioMs > ESPERA_MAX_MS;
}
