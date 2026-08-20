import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

export const locales = ['en', 'pt-BR', 'pt', 'fr', 'it', 'es'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

const detectLanguage = (): Locale => {
  const savedLang = localStorage.getItem('i18nextLng');
  if (savedLang && locales.includes(savedLang as Locale)) {
    return savedLang as Locale;
  }

  const browserLang = navigator.language;
  if (browserLang === 'pt-BR' || browserLang === 'pt_BR') {
    return 'pt-BR';
  }
  if (browserLang === 'pt') {
    return 'pt';
  }
  if (browserLang === 'fr' || browserLang.startsWith('fr-')) {
    return 'fr';
  }
  if (browserLang === 'it' || browserLang.startsWith('it-')) {
    return 'it';
  }
  if (browserLang === 'es' || browserLang.startsWith('es-')) {
    return 'es';
  }
  if (browserLang === 'en' || browserLang.startsWith('en-')) {
    return 'en';
  }

  return defaultLocale;
};

// Namespaces existentes em src/i18n/locales/pt-BR/*.json (superset — usado como
// lista única de `ns` pros 6 idiomas). ATENÇÃO: nem todo idioma tem TODOS esses
// arquivos hoje — ex.: setup.json só existe em pt-BR/ e en/ (pt, es, fr, it não
// têm). Isso já era assim antes desta mudança (o objeto `resources` estático
// também não tinha `setup` pra esses 4 idiomas). Com o backend dinâmico, pedir
// um namespace que não existe pra um idioma só faz o import() falhar e o
// i18next tratar como namespace vazio — mesmo efeito prático de antes, sem
// travar o carregamento nem quebrar o app.
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

const initialLanguage = detectLanguage();

// Carregamento sob demanda por idioma: cada `import()` vira um chunk JSON
// separado, baixado só quando aquele (idioma, namespace) é realmente
// necessário — em vez de montar os 6 idiomas × 47 namespaces inteiros no
// bundle de entrada (era a maior fatia do peso do chunk carregado em toda
// visita, inclusive na tela de login). `i18n.init()` abaixo retorna uma
// Promise (exportada como `i18nReady`) que só resolve depois que TODOS os
// namespaces do idioma ativo (+ fallback) terminam de carregar — main.tsx
// aguarda essa Promise antes de montar o React, então a primeira renderização
// já sai com o idioma certo, sem flash de chave de tradução.
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
    ns: namespaces,
    debug: false, // Set to true for debugging
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    // Key separator for nested keys
    keySeparator: '.',
    // Namespace separator
    nsSeparator: ':',
  });

export default i18n;
