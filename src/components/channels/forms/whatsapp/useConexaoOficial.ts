import { useState, useEffect, useRef } from 'react';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import WhatsappService from '@/services/channels/whatsappService';
import type { CaminhoOficial } from './EscolhaCaminhoOficial';

// FB in window
declare global {
  interface Window {
    FB: any;
    fbAsyncInit?: any;
  }
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
const PRAZO_DO_CODIGO_MS = 30_000;

// A janela da Meta fala de facebook.com ou de qualquer subdomínio dele
// (www, web, business...). Comparar pelo nome do host evita aceitar
// "evilfacebook.com", que termina igual mas é outro domínio.
export function origemDaMeta(origem: string): boolean {
  try {
    const host = new URL(origem).hostname;
    return host === 'facebook.com' || host.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

export type ResultadoDaConexao = Awaited<ReturnType<typeof WhatsappService.connectCloud>>;

interface Opcoes {
  /** Reconexão: manda o id da caixa existente junto com o código. */
  inboxId?: string;
  /** Só carrega o SDK da Meta quando a tela precisa (o banner de configurações nem sempre precisa). */
  ativo?: boolean;
  aoConectar: (resultado: ResultadoDaConexao) => void;
}

// O fluxo único de conectar o número oficial (FB.login + evento de fim + troca
// do código no servidor). Usado pela tela de novo canal e pelo Reconectar.
export function useConexaoOficial({ inboxId, ativo = true, aoConectar }: Opcoes) {
  const config = useGlobalConfig();

  const [fbSDKReady, setFbSDKReady] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sdkResponse, setSdkResponse] = useState<any>(null);
  // O caminho vale no momento do clique, mesmo se o cartão mudar durante o fluxo.
  const caminhoDoLogin = useRef<CaminhoOficial | null>(null);
  const enviando = useRef(false);
  // A tentativa atual já falhou (cancelou, deu erro ou estourou o prazo):
  // o que chegar depois dela é ignorado.
  const falhou = useRef(false);
  const prazo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoConectarRef = useRef(aoConectar);
  aoConectarRef.current = aoConectar;

  const limparPrazo = () => {
    if (prazo.current) clearTimeout(prazo.current);
    prazo.current = null;
  };

  const falhar = (mensagem: string) => {
    limparPrazo();
    falhou.current = true;
    // Zera o par código + evento: um evento de fim atrasado não pode mais
    // disparar a conexão com o código vencido.
    setSessionInfo(null);
    setSdkResponse(null);
    setErro(mensagem);
    setCarregando(false);
  };

  useEffect(() => limparPrazo, []);

  const liberado = !!config.wpAppId && !!config.wpWhatsappConfigId;

  useEffect(() => {
    if (ativo && liberado) loadFacebookSDK();
  }, [ativo, liberado, config.wpAppId, config.wpApiVersion]);

  useEffect(() => {
    if (!ativo) return;
    const handleMessage = (event: MessageEvent) => {
      if (!origemDaMeta(event.origin)) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (falhou.current) return;
        if (EVENTOS_DE_FIM.includes(data.event)) {
          setSessionInfo(data);
        } else if (data.event === 'FINISH_ONLY_WABA') {
          falhar('A Meta terminou sem escolher um número. Comece de novo e escolha o número no final.');
        } else if (data.event === 'CANCEL') {
          // Frase nossa, nunca o error_message cru da Meta (vem em inglês).
          falhar('Você fechou a janela da Meta antes de terminar.');
        } else if (data.event === 'ERROR') {
          falhar('A Meta não conseguiu concluir a conexão. Tente de novo.');
        } else if (typeof data.event === 'string' && data.event.startsWith('FINISH')) {
          falhar('Esse tipo de conexão não é aceito aqui. Tente de novo escolhendo o número.');
        }
      } catch {
        // mensagem que não é JSON: não é da Meta
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ativo]);

  // Junta o evento (ids do número) com a resposta do login (código)
  useEffect(() => {
    const code = sdkResponse?.authResponse?.code;
    if (!sessionInfo || !code || enviando.current || falhou.current) return;
    enviando.current = true;
    limparPrazo();
    const { phone_number_id, waba_id, business_id } = sessionInfo.data || {};
    enviar({
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

  const enviar = async (dados: {
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
        ...(inboxId ? { inbox_id: inboxId } : {}),
      });
      aoConectarRef.current(result);
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

  const iniciar = (caminho: CaminhoOficial) => {
    if (!window.FB) return;
    setErro(null);
    setSessionInfo(null);
    setSdkResponse(null);
    enviando.current = false;
    falhou.current = false;
    caminhoDoLogin.current = caminho;
    setCarregando(true);

    window.FB.login(
      (response: any) => {
        // Falhou antes do retorno do login (cancelou ou erro na janela):
        // nada de guardar o código nem armar o prazo.
        if (falhou.current) return;
        setSdkResponse(response);
        if (!response?.authResponse) {
          falhar('A conexão com a Meta foi cancelada.');
        } else {
          // O código vale 30 s: se o evento de fim não chegar, libera a tela.
          limparPrazo();
          prazo.current = setTimeout(() => {
            if (!enviando.current) falhar('A Meta não confirmou a conexão a tempo. Tente de novo.');
          }, PRAZO_DO_CODIGO_MS);
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

  return { liberado, pronto: fbSDKReady, carregando, erro, iniciar };
}
