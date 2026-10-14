import { data, dataCurta, diaDaSemanaCurto, hora, tempoDesde } from '@/lib/formato';

const dois = (n: number) => String(n).padStart(2, '0');

/** "2026-10-09" + "14:30" no horário de quem usa → ISO pra mandar ao servidor. */
export function juntarDataEHora(data: string, hora: string): string {
  const [a, m, d] = data.split('-').map(Number);
  const [h, min] = (hora || '00:00').split(':').map(Number);
  return new Date(a, m - 1, d, h, min, 0, 0).toISOString();
}

/** O contrário, pra preencher a janela de edição. */
export function separarDataEHora(iso: string): { data: string; hora: string } {
  const x = new Date(iso);
  return {
    data: `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}`,
    hora: `${dois(x.getHours())}:${dois(x.getMinutes())}`,
  };
}

/** Sugestão da janela nova: a próxima hora cheia. */
export function proximaHoraCheia(agora: Date = new Date()): { data: string; hora: string } {
  const x = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), agora.getHours() + 1, 0, 0, 0);
  return separarDataEHora(x.toISOString());
}

/**
 * Prazo no cartão da tarefa (14/10/2026): a hora vai à parte, o dia por extenso
 * perto de hoje ("Hoje", "Sex 16/10") e, se já venceu, há quanto tempo.
 * `atraso` sai sempre que o prazo passou; quem decide se mostra é o cartão
 * (tarefa concluída não aparece como atrasada).
 */
export function prazoDaTarefa(iso: string | null, agora: Date = new Date()): { hora: string | null; dia: string; atraso: string | null } {
  if (!iso) return { hora: null, dia: 'Sem prazo', atraso: null };
  const d = new Date(iso);
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((meiaNoite(d) - meiaNoite(agora)) / 86_400_000);
  const dia =
    dias === 0 ? 'Hoje'
      : dias === 1 ? 'Amanhã'
        : dias === -1 ? 'Ontem'
          : d.getFullYear() !== agora.getFullYear() ? data(d)
            : `${diaDaSemanaCurto(d)} ${dataCurta(d)}`;
  const atraso = d.getTime() < agora.getTime() ? tempoDesde(d, agora) : null;
  return { hora: hora(d), dia, atraso };
}
