import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Aviso from '@/components/base/Aviso';
import { Button } from '@/components/ui/ds';
import { FormSection } from '../../shared/FormSection';
import { EscolhaCaminhoOficial, type CaminhoOficial } from './EscolhaCaminhoOficial';
import { useConexaoOficial, type ResultadoDaConexao } from './useConexaoOficial';

interface CloudWhatsappFormProps {
  canFB: boolean;
}

const LINK_PAGAMENTO = 'https://business.facebook.com/billing_hub/';

export const CloudWhatsappForm = ({ canFB }: CloudWhatsappFormProps) => {
  const navigate = useNavigate();
  const [caminho, setCaminho] = useState<CaminhoOficial | null>(null);
  const [conectado, setConectado] = useState<ResultadoDaConexao | null>(null);
  const { liberado: configurado, pronto: fbSDKReady, carregando, erro, iniciar } = useConexaoOficial({
    ativo: canFB,
    aoConectar: setConectado,
  });
  const liberado = canFB && configurado;

  if (!liberado) {
    return (
      <Aviso tom="neutro">
        A conexão com a API oficial ainda não está liberada neste LM Flow.
      </Aviso>
    );
  }

  if (conectado) {
    return (
      <div className="space-y-4">
        <Aviso tom="sucesso" titulo="Número conectado">
          {conectado.name} já está na sua lista de canais.
        </Aviso>
        {conectado.message && <Aviso tom="info">{conectado.message}</Aviso>}
        <Aviso tom="atencao">
          A Meta cobra as mensagens no cartão da sua empresa. Cadastre a forma de pagamento no painel da Meta,
          senão o número só responde até 1.000 mensagens no mês.{' '}
          <a href={LINK_PAGAMENTO} target="_blank" rel="noopener noreferrer" className="underline">
            Abrir o painel de pagamento da Meta
          </a>
        </Aviso>
        <Button type="button" onClick={() => navigate(`/channels/${conectado.inbox_id}/oficial`)}>
          Abrir o número
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FormSection title="Como esse número é usado hoje?" data-tour="whatsapp-cloud-connect">
        <div className="space-y-4">
          <EscolhaCaminhoOficial value={caminho} onChange={setCaminho} disabled={carregando} />
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={() => caminho && iniciar(caminho)}
              disabled={!fbSDKReady || carregando || !caminho}
            >
              {carregando ? 'Conectando...' : !fbSDKReady ? 'Carregando...' : 'Conectar pela Meta'}
            </Button>
          </div>
        </div>
      </FormSection>
    </div>
  );
};
