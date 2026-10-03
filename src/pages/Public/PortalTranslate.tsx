// Botão de idiomas do site (Meu site · Tradução): tradutor do Google.
import { useEffect } from 'react';

type TranslateCtor = { new (o: object, id: string): unknown; InlineLayout?: { SIMPLE: number } };
type W = Window & { google?: { translate?: { TranslateElement?: TranslateCtor } }; __lmfTranslateInit?: () => void };

export default function PortalTranslate({ languages }: { languages: string[] }) {
  useEffect(() => {
    if (!languages.length) return;
    const w = window as W;
    // A cada montagem o cabeçalho cria uma div nova: o init roda de novo nela.
    const init = () => {
      const T = w.google?.translate?.TranslateElement;
      const el = document.getElementById('lmf-google-translate');
      if (!T || !el) return;
      el.innerHTML = '';
      new T({ pageLanguage: 'pt', includedLanguages: languages.join(','), layout: T.InlineLayout?.SIMPLE, autoDisplay: false }, 'lmf-google-translate');
    };
    w.__lmfTranslateInit = init;
    if (w.google?.translate?.TranslateElement) { init(); return; }
    if (document.getElementById('lmf-gt-script')) return; // já carregando: o callback chama o init
    const s = document.createElement('script');
    s.id = 'lmf-gt-script';
    s.async = true;
    s.src = 'https://translate.google.com/translate_a/element.js?cb=__lmfTranslateInit';
    document.head.appendChild(s);
  }, [languages.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!languages.length) return null;
  return <div id="lmf-google-translate" role="group" aria-label="Idioma" className="text-sm" />;
}
