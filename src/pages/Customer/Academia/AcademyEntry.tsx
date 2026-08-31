// Porta de entrada da Área de Membros.
//
// A aula é uma tela DENTRO do app de cada imobiliária, atrás do login dela —
// não existe um endereço único onde qualquer pessoa assista. Quem cai aqui é
// quem abriu o link da aula fora do app do próprio cliente: o link que sai no
// aviso de WhatsApp da Leal Mídia, e qualquer link colado em outro lugar.
//
// Esta tela faz UMA pergunta (o e-mail de acesso), descobre o app da pessoa e a
// encaminha para a mesma aula lá dentro, onde ela faz o login de sempre. O
// aparelho lembra a resposta, então da segunda vez o link abre direto.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GraduationCap, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import {
  academyEntryService,
  lerClienteLembrado,
  lembrarCliente,
  esquecerCliente,
  type ClienteLembrado,
} from '@/services/academy/academyEntryService';

// Quanto a tela do "levando você para..." fica no ar antes de sair. Existe para
// dar tempo de clicar em "não é você?" — sem isso, quem usa o aparelho de outra
// pessoa ficaria preso no app errado para sempre.
const ESPERA_MS = 1600;

export default function AcademyEntry() {
  const location = useLocation();
  const destino = `${location.pathname}${location.search}`;

  const [lembrado, setLembrado] = useState<ClienteLembrado | null>(null);
  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  // Segunda visita em diante: já sabemos o app, então só avisamos e seguimos.
  useEffect(() => {
    const salvo = lerClienteLembrado();
    if (!salvo) return undefined;
    setLembrado(salvo);
    const timer = window.setTimeout(() => {
      window.location.href = `${salvo.host}${destino}`;
    }, ESPERA_MS);
    return () => window.clearTimeout(timer);
  }, [destino]);

  function trocarDeCliente() {
    esquecerCliente();
    setLembrado(null);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setErro('');
    try {
      const r = await academyEntryService.resolve(email);
      const dados = r.data.data;
      if (!dados.found || !dados.host || !dados.slug) {
        setErro('Não encontramos esse e-mail. Confira se é o mesmo que você usa para entrar no sistema.');
        return;
      }
      lembrarCliente({ slug: dados.slug, name: dados.name ?? '', host: dados.host });
      window.location.href = `${dados.host}${destino}`;
    } catch {
      setErro('Não deu para conferir agora. Tente de novo em alguns instantes.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-5">
          <GraduationCap size={22} className="text-primary" />
          <h1 className="text-lg font-bold">Área de Membros</h1>
        </div>

        {lembrado ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-primary shrink-0" />
              Abrindo a aula em <strong>{lembrado.name || lembrado.slug}</strong>...
            </p>
            <button
              onClick={trocarDeCliente}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
              type="button"
            >
              Não é você? Entrar com outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={entrar} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Tem aula nova esperando por você</p>
              <p className="text-xs text-muted-foreground">
                As aulas ficam dentro do seu próprio sistema. Diga o e-mail que você usa para
                entrar e a gente te leva direto para a aula.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="entrada-email">
                Seu e-mail de acesso
              </label>
              <input
                id="entrada-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="voce@suaimobiliaria.com.br"
                className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-border outline-none focus:border-primary/50"
              />
            </div>

            {erro && (
              <p className="text-xs text-red-500 flex items-start gap-1.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={buscando || !email.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Abrir a aula
            </button>

            <p className="text-[11px] text-muted-foreground">
              Você vai entrar no sistema da sua imobiliária, com o mesmo login de sempre.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
