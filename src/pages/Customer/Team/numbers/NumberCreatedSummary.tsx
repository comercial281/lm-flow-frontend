import { CheckCircle2, Clock, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { telefone } from '@/lib/formato';

/* O que aconteceu depois de "Criar número": a lista do que ficou pronto e do que
   falta. Fica separado da janela porque o "Adicionar pessoa" (F1-T5) mostra a
   mesma tela, com a linha a mais "Cadastrado como Corretor" (extraLines).

   O número fica criado mesmo quando o link falha: dizer isso com todas as letras
   (e oferecer só o link de novo) evita a pessoa criar um segundo número. */

export type LinkSent = 'sent' | 'error' | 'skipped';

export interface NumberCreatedSummaryProps {
  personName: string;
  numberName: string;
  /** Celular da pessoa, para onde o link foi (ou iria). */
  phone?: string;
  linkSent: LinkSent;
  /** Motivo quando o link não saiu (frase pronta, mostrada como veio). */
  linkError?: string;
  inboxId: string;
  /** Linhas prontas antes das de sempre, ex.: "Cadastrado como Corretor". */
  extraLines?: string[];
  onOpenQr: () => void;
  onDone: () => void;
  onRetryLink?: () => void;
  retrying?: boolean;
}

export default function NumberCreatedSummary({
  personName, numberName, phone, linkSent, linkError, extraLines = [], onOpenQr, onDone, onRetryLink, retrying,
}: NumberCreatedSummaryProps) {
  const linkOk = linkSent === 'sent';
  return (
    <div className="space-y-4">
      <ul className="space-y-2 text-sm">
        {extraLines.map(line => <Line key={line} text={line} />)}
        <Line text={`Número ${numberName} criado, com ${personName} como dono`} />
        {linkOk ? (
          <Line text={`Link de acesso enviado para ${telefone(phone) || phone || 'o celular'} · vale 24 h`} />
        ) : (
          <li className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              Link não enviado: {linkError || 'motivo desconhecido'}
              {onRetryLink && (
                <Button
                  variant="outline" size="sm" className="ml-2 h-7" onClick={onRetryLink} disabled={retrying}
                >
                  {retrying && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  Tentar de novo
                </Button>
              )}
            </span>
          </li>
        )}
        <li className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Esperando {personName} conectar o número</span>
        </li>
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onOpenQr}>{personName} está aqui: abrir QR code</Button>
        <Button onClick={onDone}>Concluir</Button>
      </div>
    </div>
  );
}

function Line({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
      <span>{text}</span>
    </li>
  );
}
