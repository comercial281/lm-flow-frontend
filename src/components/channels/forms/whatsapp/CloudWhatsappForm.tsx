import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import WhatsappService from '@/services/channels/whatsappService';
import Aviso from '@/components/base/Aviso';
import { Button } from '@/components/ui/ds';
import { FormSection } from '../../shared/FormSection';
import { EscolhaCaminhoOficial, type CaminhoOficial } from './EscolhaCaminhoOficial';

// FB in window
declare global {
  interface Window {
    FB: any;
    fbAsyncInit?: any;
  }
}

interface CloudWhatsappFormProps {
  canFB: boolean;
}

// Extras do FB.login por caminho. Doc da Meta (Embedded Signup v4/v5, páginas
// "versions" e "onboarding-business-app-users"): v2 e v3 morreram em 15/10/2026;
// na v4 o extras é "propositalmente vazio" e a versão vem da configuração do login.
// Coexistência pede featureType 'whatsapp_business_app_onboarding' (na v5 já vem ligado).
const EXTRAS: Record<CaminhoOficial, Record<string, unknown>> = {
  coexistence: {
    setup: {},
    featureType: 'whatsapp_business_app_onboarding',
    sessionInfoVersion: '3',
  },
  new_number: {
    setup: {},
    sessionInfoVersion: '3',
  },
};

const EVENTOS_DE_FIM = ['FINISH', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'];
const LINK_PAGAMENTO = 'https://business.facebook.com/billing_hub/';

export const CloudWhatsappForm = ({ canFB }: CloudWhatsappFormProps) => {
  const config = useGlobalConfig();
  const navigate = useNavigate();

  const [caminho, setCaminho] = useState<CaminhoOficial | null>(null);
  const [fbSDKReady, setFbSDKReady] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conectado, setConectado] = useState<{ inbox_id: string; name: string } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sdkResponse, setSdkResponse] = useState<any>(null);
  // O caminho vale no momento do clique, mesmo se o cartão mudar durante o fluxo.
  const caminhoDoLogin = useRef<CaminhoOficial | null>(null);
  const enviando = useRef(false);

  const liberado = canFB && !!config.wpAppId;

  useEffect(() => {
    if (liberado) loadFacebookSDK();
  }, [liberado, config.wpAppId, config.wpApiVersion]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (EVENTOS_DE_FIM.includes(data.event)) {
          setSessionInfo(data);
        } else if (data.event === 'FINISH_ONLY_WABA') {
          setErro('A Meta terminou sem escolher um número. Comece de novo e escolha o número no final.');
          setCarregando(false);
        } else if (data.event === 'CANCEL') {
          setErro('Você fechou a janela da Meta antes de terminar.');
          setCarregando(false);
        } else if (data.event === 'ERROR') {
          setErro(data.data?.error_message || 'A Meta não conseguiu concluir. Tente de novo.');
          setCarregando(false);
        }
      } catch {
        // mensagem que não é JSON: não é da Meta
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Junta o evento (ids do número) com a resposta do login (código)
  useEffect(() => {
    const code = sdkResponse?.authResponse?.code;
    if (!sessionInfo || !code || enviando.current) return;
    enviando.current = true;
    const { phone_number_id, waba_id, business_id } = sessionInfo.data || {};
    conectar({
      code,
      phone_number_id: phone_number_id || '',
      waba_id: waba_id || '',
      business_id: business_id || '',
    });
  }, [sessionInfo, sdkResponse]);

  const loadFacebookSDK = () => {
    if (window.FB && window.FB.getLoginStatus) {
      setFbSDKReady(true);
      return;
    }
    const init = function () {
      window.FB.init({
        appId: config.wpAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: config.wpApiVersion || 'v23.0',
      });
      setFbSDKReady(true);
    };
    if (document.querySelector('script[src*="sdk.js"]')) {
      if (!window.fbAsyncInit) window.fbAsyncInit = init;
      return;
    }
    window.fbAsyncInit = init;
    // Sem crossOrigin: o CDN da Meta não manda os cabeçalhos CORS e o navegador barraria o script.
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    document.head.appendChild(script);
  };

  const conectar = async (dados: {
    code: string;
    phone_number_id: string;
    waba_id: string;
    business_id: string;
  }) => {
    try {
      setCarregando(true);
      const result = await WhatsappService.connectCloud({
        ...dados,
        mode: caminhoDoLogin.current ?? 'new_number',
      });
      setConectado({ inbox_id: result.inbox_id, name: result.name });
    } catch (e: any) {
      setErro(e?.response?.data?.error || 'Não deu pra conectar o número agora. Tente de novo.');
      // libera uma nova tentativa
      setSessionInfo(null);
      setSdkResponse(null);
      enviando.current = false;
    } finally {
      setCarregando(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB || !caminho) return;
    setErro(null);
    setSessionInfo(null);
    setSdkResponse(null);
    enviando.current = false;
    caminhoDoLogin.current = caminho;
    setCarregando(true);

    window.FB.login(
      (response: any) => {
        setSdkResponse(response);
        if (!response?.authResponse) {
          setErro('A conexão com a Meta foi cancelada.');
          setCarregando(false);
        }
      },
      {
        config_id: config.wpWhatsappConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: EXTRAS[caminho],
      },
    );
  };

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
              onClick={handleFacebookLogin}
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
