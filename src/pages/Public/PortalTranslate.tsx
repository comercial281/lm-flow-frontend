// Botão de idiomas do site (Meu site · Tradução): tradutor do Google.
import { useEffect } from 'react';

type W = Window & { google?: { translate?: { TranslateElement: new (o: object, id: string) => unknown } }; __lmfTranslateInit?: () => void };

export default function PortalTranslate({ languages }: { languages: string[] }) {
  useEffect(() => {
    const w = window as W;
    if (!languages.length || document.getElementById('lmf-gt-script')) return;
    w.__lmfTranslateInit = () => {
      const T = w.google?.translate?.TranslateElement as unknown as { new (o: object, id: string): unknown; InlineLayout?: { SIMPLE: number } };
      if (!T) return;
      new T({ pageLanguage: 'pt', includedLanguages: languages.join(','), layout: T.InlineLayout?.SIMPLE, autoDisplay: false }, 'lmf-google-translate');
    };
    const s = document.createElement('script');
    s.id = 'lmf-gt-script';
    s.async = true;
    s.src = 'https://translate.google.com/translate_a/element.js?cb=__lmfTranslateInit';
    document.head.appendChild(s);
  }, [languages.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!languages.length) return null;
  return <div id="lmf-google-translate" aria-label="Idioma" className="text-sm" />;
}
