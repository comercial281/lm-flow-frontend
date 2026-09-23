// Convite de acesso: a pessoa abre o link que recebeu no WhatsApp, cria a
// senha dela e já entra.
//
// Por que esta tela existe (22/09/2026): o acesso era mandado como "Login: x /
// Senha: y" dentro de uma mensagem, e a pessoa copiava a senha no celular.
// Copiar uma palavra por toque duplo no iOS leva o espaço seguinte junto, e a
// senha era recusada com o campo mostrando a senha certa. Aqui não há o que
// copiar: ela digita a que quiser, duas vezes.
//
// A tela NÃO entra sozinha ao abrir. O WhatsApp pré-visualiza links, e um
// convite que se consome no carregamento seria queimado pela pré-visualização
// antes de a pessoa tocar nele.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Input, Label, Button, Alert, AlertTitle, AlertDescription } from '@/components/ui/ds';
import { AppLogo } from '@/components/AppLogo';
import { accessLinkService, AccessLinkInvite } from '@/services/auth/accessLinkService';
import { checkNewPassword } from '@/features/auth/passwordRules';
import { AVISO_SEM_ARMAZENAMENTO } from '@/features/auth/sessionPersistence';
import { loginFeedback } from '@/features/auth/loginFeedback';
import { useAuthStore } from '@/store/authStore';

const AccessInvite: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t') ?? '';

  const [carregando, setCarregando] = useState(true);
  const [convite, setConvite] = useState<AccessLinkInvite | null>(null);
  const [erroLeitura, setErroLeitura] = useState('');

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const abrirConvite = useCallback(async () => {
    if (!token) {
      setConvite({ valid: false, message: 'Este endereço não tem um convite. Abra o link exatamente como ele foi enviado.' });
      setCarregando(false);
      return;
    }
    try {
      setConvite(await accessLinkService.peek(token));
    } catch (e) {
      // Sem resposta do servidor a tela não afirma a causa — ela só diz o que sabe.
      setErroLeitura(loginFeedback(e).description);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => { void abrirConvite(); }, [abrirConvite]);

  const concluir = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkNewPassword(senha, confirma);
    if (!check.ok) { setErro(check.message); return; }

    setEnviando(true);
    setErro('');
    try {
      const result = await accessLinkService.redeem(token, senha, confirma);

      if (result.access_token) {
        const { setAccessToken, validityCheck } = useAuthStore.getState();
        setAccessToken(result.access_token);
        await validityCheck();

        if (!useAuthStore.getState().sessionPersisted) {
          toast.warning('Senha criada, mas a sessão não ficou salva', {
            description: AVISO_SEM_ARMAZENAMENTO,
            duration: 12000,
          });
        }
        toast.success('Tudo certo! Sua senha foi criada.');
        navigate('/', { replace: true });
        return;
      }

      // Sem sessão pronta (instalação que autentica por fora): a senha foi
      // criada do mesmo jeito, então a pessoa é mandada ao login com o motivo
      // à vista, e não deixada numa tela que não sabe explicar o que houve.
      toast.success('Senha criada! Agora é só entrar com ela.');
      navigate('/login', { replace: true });
    } catch (e) {
      setErro(loginFeedback(e).description);
    } finally {
      setEnviando(false);
    }
  };

  const fieldCls = 'space-y-1.5';

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: '#0F0520' }}>
      <div className="w-full max-w-sm">
        <AppLogo className="h-7 mb-8" />

        {carregando && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Abrindo seu convite...</p>
        )}

        {!carregando && erroLeitura && (
          <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não consegui abrir o convite</AlertTitle>
            <AlertDescription>{erroLeitura}</AlertDescription>
          </Alert>
        )}

        {!carregando && !erroLeitura && convite && !convite.valid && (
          <>
            <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Este link não vale mais</AlertTitle>
              <AlertDescription>{convite.message}</AlertDescription>
            </Alert>
            <Button
              type="button"
              variant="ghost"
              className="mt-4 text-white/70 hover:text-white"
              onClick={() => navigate('/login')}
            >
              Ir para a tela de entrada
            </Button>
          </>
        )}

        {!carregando && !erroLeitura && convite?.valid && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">
                {convite.name ? `Olá, ${convite.name}!` : 'Bem-vindo!'}
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Crie a sua senha para entrar{convite.tenant ? ` no CRM da ${convite.tenant}` : ''}.
                {convite.email_hint ? ` Seu login é ${convite.email_hint}.` : ''}
              </p>
            </div>

            {erro && (
              <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confira a senha</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={concluir} className="space-y-4">
              <div className={fieldCls}>
                <Label htmlFor="nova-senha" className="text-white/70 text-sm">Sua nova senha</Label>
                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={verSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSenha(e.target.value)}
                    disabled={enviando}
                    autoComplete="new-password"
                    // O teclado do celular corrige e capitaliza sozinho — e com
                    // o olho aberto este campo é um campo de texto comum.
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    className="bg-white/10 border-white/25 text-white placeholder:text-white/45 pr-10"
                    placeholder="Pelo menos 6 caracteres"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setVerSenha(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className={fieldCls}>
                <Label htmlFor="confirma-senha" className="text-white/70 text-sm">Repita a senha</Label>
                <Input
                  id="confirma-senha"
                  type={verSenha ? 'text' : 'password'}
                  value={confirma}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirma(e.target.value)}
                  disabled={enviando}
                  autoComplete="new-password"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className="bg-white/10 border-white/25 text-white placeholder:text-white/45"
                  placeholder="A mesma senha de novo"
                />
              </div>

              <Button type="submit" disabled={enviando} className="w-full">
                {enviando ? 'Criando...' : 'Criar senha e entrar'}
                {!enviando && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </form>

            <p className="mt-6 text-xs flex items-start gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              Só você vai saber esta senha. Este link funciona uma única vez — depois de criar, entre sempre pela tela de
              login.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default AccessInvite;
