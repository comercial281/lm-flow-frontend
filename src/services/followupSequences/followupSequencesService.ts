import api from '@/services/core/api';

// Fase 4 (Entrega B): o funil de follow-up do formato antigo saiu da tela. Aqui
// ficam só as duas pontas que ainda têm uso: o envio de mídia do agendamento
// (ScheduleActionModal) e a leitura do arquivo de funil do super admin
// (ClientFollowupRolloutModal).

/** O que vem dentro de um arquivo de funil exportado. A tela lê o arquivo antes
 *  de mandar pro servidor pra mostrar a prévia — importar às cegas o que veio de
 *  outro cliente é o mesmo problema que "escolher modelo sem ver o texto". */
export interface FollowupPackage {
  format: string;
  version: number;
  exported_at?: string;
  exported_from?: string | null;
  warnings?: string[];
  sequence: {
    name: string;
    slug?: string;
    description?: string | null;
    steps: { message_type: string; media?: unknown }[];
    entries?: unknown[];
  };
}

/** O resumo que a janela de confirmação mostra. Montado no navegador a partir do
 *  arquivo — o servidor devolve o mesmo depois, mas aí já teria importado. */
export interface FollowupPackageSummary {
  name: string;
  exportedFrom: string | null;
  stepsCount: number;
  mediaCount: number;
  entriesCount: number;
  warnings: string[];
}

/** Formato aceito pelo importador. Fica aqui (e não solto na tela) porque o
 *  servidor recusa qualquer outro: os dois lados precisam dizer a mesma coisa. */
export const FOLLOWUP_PACKAGE_FORMAT = 'lm_flow.followup_package';

const BASE = '/followup_sequences';

export const followupSequencesService = {
  async uploadMedia(file: File): Promise<{
    url: string;
    filename: string;
    content_type: string;
    byte_size: number;
  }> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`${BASE}/upload_media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as { data: { url: string; filename: string; content_type: string; byte_size: number } }).data;
  },
};

/** Lê o conteúdo do arquivo escolhido.
 *
 *  Usa `FileReader` e não `File.text()`: o segundo não existe em todo ambiente
 *  (nem no que roda os testes), e a falha dele é indistinguível de "arquivo
 *  corrompido" — o que mandaria a pessoa procurar problema no arquivo certo. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Lê o arquivo escolhido e devolve o funil junto com o resumo, ou a mensagem do
 *  que está errado com ele. Roda no navegador de propósito: a pessoa vê o que vai
 *  entrar ANTES de qualquer coisa ser criada no CRM. O servidor valida de novo —
 *  esta é a cortesia, não a barreira. */
export async function readFollowupPackage(
  file: File,
): Promise<
  | { pkg: FollowupPackage; summary: FollowupPackageSummary; error: null }
  | { pkg: null; summary: null; error: string }
> {
  let parsed: FollowupPackage;
  try {
    parsed = JSON.parse(await readFileText(file)) as FollowupPackage;
  } catch {
    return { pkg: null, summary: null, error: 'Não deu pra ler o arquivo — ele parece estar corrompido.' };
  }

  if (!parsed || parsed.format !== FOLLOWUP_PACKAGE_FORMAT) {
    return { pkg: null, summary: null, error: 'Este arquivo não é um funil de follow-up exportado do LM Flow.' };
  }

  const steps = Array.isArray(parsed.sequence?.steps) ? parsed.sequence.steps : [];
  if (steps.length === 0) {
    return { pkg: null, summary: null, error: 'O funil deste arquivo não tem nenhuma mensagem.' };
  }

  return {
    pkg: parsed,
    error: null,
    summary: {
      name: parsed.sequence.name,
      exportedFrom: parsed.exported_from ?? null,
      stepsCount: steps.length,
      mediaCount: steps.filter(s => !!s.media).length,
      entriesCount: Array.isArray(parsed.sequence.entries) ? parsed.sequence.entries.length : 0,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    },
  };
}
