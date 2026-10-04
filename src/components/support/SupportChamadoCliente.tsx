import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { erroDaApi, supportService } from '@/services/support/supportService';
import SupportThread from './SupportThread';
import SupportComposer from './SupportComposer';
import { useChamado } from './useChamado';

interface Props {
  id: string;
  /** Mostra o balão de confirmação logo depois de abrir. */
  recemCriado?: boolean;
  /** Abrir = ler: o contador da bolinha precisa recontar. */
  onLido: () => void;
}

export default function SupportChamadoCliente({ id, recemCriado, onLido }: Props) {
  const carregar = useCallback(() => supportService.show(id), [id]);
  const { dado, erro, recarregar } = useChamado(carregar);

  useEffect(() => {
    if (dado) onLido();
  }, [dado?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (body: string, imagens: File[]) => {
    try {
      await supportService.reply(id, body, imagens);
      await recarregar();
    } catch (e) {
      toast.error(erroDaApi(e, 'Não consegui enviar. Tente novamente.'));
      throw e;
    }
  };

  if (erro && !dado) return <p className="p-4 text-sm text-destructive">{erro}</p>;
  if (!dado) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <SupportThread mensagens={dado.messages} eu="customer" />
        {recemCriado && (
          <p className="mx-3 mb-3 w-fit max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
            Recebemos! O time responde por aqui e você também recebe por e-mail.
          </p>
        )}
        {dado.status === 'resolved' && (
          <div className="mx-3 mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">Este chamado foi resolvido.</p>
            <p className="text-muted-foreground">Se precisar, é só escrever de novo.</p>
          </div>
        )}
      </div>
      <SupportComposer onEnviar={responder} />
    </div>
  );
}
