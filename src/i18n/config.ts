import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

// ── IDIOMA ÚNICO: PORTUGUÊS DO BRASIL ────────────────────────────────────────
//
// O sistema tinha 6 idiomas (en, pt-BR, pt, fr, it, es) e o padrão de reserva
// era o INGLÊS. Toda chave ausente no pt-BR renderizava em inglês — sem erro,
// sem aviso, sem quebrar lint nem teste. Eram 117 chaves ausentes e 329 com o
// texto inglês dentro do próprio arquivo português: ~450 pontos de inglês numa
// tela vendida para imobiliária brasileira.
//
// Decisão: manter só o pt-BR, completo. Os outros cinco foram removidos.
// O pt-BR passou a ter 7.788 chaves, cobrindo 100% do que o inglês tinha.
//
// ⚠️ SE UM DIA VOLTAR A TER MAIS DE UM IDIOMA: o padrão de reserva tem que
// continuar sendo pt-BR, nunca o inglês. Reserva em inglês é exatamente o que
// produz tela em inglês em silêncio.
export const locales = ['pt-BR'] as const;
export const defaultLocale = 'pt-BR' as const;

export type Locale = (typeof locales)[number];

// Chave que o i18next usa pra lembrar o idioma escolhido. Quem usou o sistema
// antes desta mudança pode ter 'en'/'es'/'fr'/'it'/'pt' salvo aqui — e esses
// arquivos não existem mais. Sem esta limpeza o import() falharia e a tela
// viria com as CHAVES cruas no lugar do texto.
const LNG_KEY = 'i18nextLng';

const forcarPtBr = (): Locale => {
  try {
    if (localStorage.getItem(LNG_KEY) !== defaultLocale) {
      localStorage.setItem(LNG_KEY, defaultLocale);
    }
  } catch {
    // Navegador anônimo ou dados de site bloqueados — segue sem guardar.
  }
  return defaultLocale;
};

// Namespaces existentes em src/i18n/locales/pt-BR/*.json.
const namespaces = [
  'accessTokens',
  'accountSettings',
  'agents',
  'aiAgents',
  'api',
  'apiKeys',
  'attachments',
  'auth',
  'cannedResponses',
  'changePassword',
  'channels',
  'chat',
  'common',
  'contacts',
  'customAttributes',
  'customMcpServers',
  'customTools',
  'customerMcpServers',
  'documentation',
  'email',
  'instagram',
  'integrations',
  'labels',
  'layout',
  'macros',
  'marketplace',
  'mcpServers',
  'messenger',
  'notFound',
  'oauth',
  'onboarding',
  'pipelines',
  'profile',
  'setup',
  'sms',
  'teams',
  'telegram',
  'tools',
  'tours',
  'tutorials',
  'unauthorized',
  'users',
  'webWidget',
  'whatsapp',
  'widget',
] as const;

const initialLanguage = forcarPtBr();

// Carregamento sob demanda: cada import() vira um pedaço separado, baixado só
// quando aquele namespace é realmente necessário. `i18nReady` só resolve depois
// que todos os namespaces terminam de carregar — main.tsx espera essa Promise
// antes de montar o React, então a primeira renderização já sai com o texto
// certo, sem piscar chave de tradução na tela.
export const i18nReady = i18n
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)
    )
  )
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: defaultLocale,
    supportedLngs: locales as unknown as string[],
    ns: namespaces,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    keySeparator: '.',
    nsSeparator: ':',
  });

export default i18n;
