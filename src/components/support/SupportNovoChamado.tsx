import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { erroDaApi, supportService, type SupportKind } from '@/services/support/supportService';
import SupportComposer from './SupportComposer';

const ABERTURA: Record<SupportKind, string> = {
  question: 'Me conta sua dúvida que o time responde por aqui.',
  bug: 'Me conta o que aconteceu e em qual tela. Se puder, manda um print.',
  suggestion: 'Conta sua ideia. O que você gostaria que o LM Flow fizesse?',
};

interface Props {
  kind: SupportKind;
  subject?: string;
  faqTopic?: string;
  rascunho?: string;
  onCriado: (id: string) => void;
}

/** Abrir chamado: o balão do suporte pergunta, a pessoa escreve (e anexa print). */
export default function SupportNovoChamado({ kind, subject, faqTopic, rascunho, onCriado }: Props) {
  const location = useLocation();

  const enviar = async (body: string, imagens: File[]) => {
    try {
      const t = await supportService.open({ kind, body, subject, faqTopic, pageUrl: location.pathname, imagens });
      onCriado(t.id);
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui enviar. Tente novamente.'));
      throw e;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 p-3">
        <p className="w-fit max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">{ABERTURA[kind]}</p>
      </div>
      {/* O rascunho vem da busca sem resultado ("boleto atrasado" já entra escrito). */}
      <SupportComposer key={rascunho ?? ''} onEnviar={enviar} exigeTexto textoInicial={rascunho} />
    </div>
  );
}
