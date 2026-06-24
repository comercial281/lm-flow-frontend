import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Input,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import { login, register, forgotPassword } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/store/authStore';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useLanguage } from '@/hooks/useLanguage';
import MfaVerification from '@/components/auth/MfaVerification';
import { twoFactorService } from '@/services/profile/twoFactorService';
import { motion, AnimatePresence } from 'framer-motion';

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Globe, ArrowRight, ChevronLeft, Eye, EyeOff } from 'lucide-react';

import { ApiError } from '@/types/auth';
import { type Locale } from '@/i18n/config';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import { AppLogo } from '@/components/AppLogo';
import FlowBackground from './FlowBackground';

// ─── Animation variants ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUpVariant: any = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slideIn: any = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: -30, transition: { duration: 0.25 } },
};

// ─── Left panel: brand + flow visual ─────────────────────────────────────
const LeftPanel: React.FC = () => (
  <div className="relative hidden lg:flex flex-col justify-between h-full px-12 py-10 overflow-hidden">
    <FlowBackground />

    {/* Content above the background */}
    <div className="relative z-10">
      <AppLogo className="h-8" />
    </div>

    <div className="relative z-10 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
           style={{ color: 'rgba(167,100,250,0.8)' }}>
          CRM Imobiliario
        </p>
        <h1 className="text-4xl font-bold leading-tight text-white">
          Cada lead<br />
          <span style={{ color: '#c084fc' }}>no lugar certo.</span>
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.6 }}
        className="flex flex-col gap-3"
      >
        {[
          { label: 'Roteirização automatica de leads', dot: '#7c3aed' },
          { label: 'Follow-up por WhatsApp sem intervencao', dot: '#9333ea' },
          { label: 'Pipeline visual com conversao em tempo real', dot: '#a855f7' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            custom={i}
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-3"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.dot, boxShadow: `0 0 6px ${item.dot}` }} />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {item.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>

    <div className="relative z-10">
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Leal Midia &copy; {new Date().getFullYear()}
      </p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────
export const Auth: React.FC = () => {
  const { login: authLogin, mfaState, verifyMfaCode, clearMfaState, setMfaRequired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { executeRecaptcha } = useRecaptcha({ autoLoad: false });
  const { t, currentLanguage, changeLanguage } = useLanguage('auth');
  const globalConfig = useGlobalConfig();

  const enableAccountSignup = globalConfig.enableAccountSignup === true;

  type TabKey = 'login' | 'register' | 'forgot';
  const [activeTab, setActiveTab] = useState<TabKey>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  const sessionExpiredToastShown = useRef(false);

  useEffect(() => {
    if (!enableAccountSignup && activeTab === 'register') setActiveTab('login');
  }, [enableAccountSignup, activeTab]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('session_expired') === 'true' && !sessionExpiredToastShown.current) {
      sessionExpiredToastShown.current = true;
      toast.error(t('auth.sessionExpired.title'), { description: t('auth.sessionExpired.description') });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (p.get('confirmation_success') === 'true') {
      toast.success(t('auth.register.confirmationSuccess'), { description: t('auth.register.confirmationSuccessDescription') });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (p.get('error') === 'access-denied') {
      toast.error(t('auth.errors.accessDenied'), { description: t('auth.errors.accessDeniedDescription') });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (p.get('confirmation_error') === 'true') {
      toast.error(t('auth.errors.confirmationError'), { description: t('auth.errors.confirmationErrorDescription') });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.search, t]);

  // ── Schemas ──
  const loginSchema = z.object({
    email:    z.string().min(1, { message: t('auth.errors.email.required') }).email({ message: t('auth.errors.email.invalid') }),
    password: z.string().min(1, { message: t('auth.errors.password.required') }).min(8, { message: t('auth.errors.password.minLength') }),
  });
  const registerSchema = z.object({
    fullName:        z.string().min(1, { message: t('auth.errors.fullName.required') }).min(2, { message: t('auth.errors.fullName.minLength') }),
    email:           z.string().min(1, { message: t('auth.errors.email.required') }).email({ message: t('auth.errors.email.invalid') }),
    password:        z.string().min(8, { message: t('auth.errors.password.minLength') }).max(128, { message: t('auth.errors.password.maxLength') }).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/, { message: t('auth.errors.password.pattern') }),
    confirmPassword: z.string().min(1, { message: t('auth.errors.confirmPassword.required') }),
  }).refine(d => d.password === d.confirmPassword, { message: t('auth.errors.confirmPassword.mismatch'), path: ['confirmPassword'] });
  const forgotPasswordSchema = z.object({
    email: z.string().min(1, { message: t('auth.errors.email.required') }).email({ message: t('auth.errors.email.invalid') }),
  });

  type LoginFormData = z.infer<typeof loginSchema>;
  type RegisterFormData = z.infer<typeof registerSchema>;
  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema), defaultValues: { email: (typeof window !== 'undefined' && localStorage.getItem('lmflow:email')) || '', password: '' } });
  const registerForm = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' } });
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true); setLoginError('');
    try { if (rememberMe) localStorage.setItem('lmflow:email', data.email); else localStorage.removeItem('lmflow:email'); } catch { /* noop */ }
    try {
      // reCAPTCHA não pode travar o login: nos subdomínios novos (*.lmflow.com.br)
      // o reCAPTCHA pode falhar por domínio não-registrado. O backend não exige o
      // token, então se falhar, segue sem ele.
      let recaptchaToken: string | null = null;
      try { recaptchaToken = await executeRecaptcha('login'); } catch { recaptchaToken = null; }
      const result = await login({ email: data.email, password: data.password, recaptcha_token: recaptchaToken || undefined });
      if (result.requiresMfa && result.mfaData) {
        const mfaData = result.mfaData as { method: 'totp' | 'email'; tempToken: string; email: string };
        setMfaRequired({ required: true, ...mfaData });
        return;
      }
      await authLogin(result.response.data.user, { access_token: result.response.data.token?.access_token || result.response.data.token?.token?.access_token });
      const { validityCheck } = useAuthStore.getState();
      await validityCheck();
      const returnUrl = new URLSearchParams(location.search).get('returnUrl');
      if (returnUrl) window.location.href = returnUrl;
      else navigate('/', { replace: true });
    } catch (error) {
      const apiError = error as ApiError;
      const msg = apiError?.response?.data?.message || apiError?.response?.data?.detail || t('auth.notifications.loginError');
      toast.error(t('auth.login.invalidCredentials'), { description: msg });
      setLoginError(msg);
    } finally { setIsLoading(false); }
  };

  const onRegisterSubmit = async (data: RegisterFormData) => {
    setIsLoading(true); setRegisterError('');
    try {
      let recaptchaToken: string | null = null;
      try { recaptchaToken = await executeRecaptcha('register'); } catch { recaptchaToken = null; }
      await register({ email: data.email, password: data.password, password_confirmation: data.confirmPassword, name: data.fullName, recaptcha_token: recaptchaToken || undefined });
      toast.success(t('auth.register.registrationSuccessful'));
      setActiveTab('login');
    } catch (error) {
      const apiError = error as ApiError;
      const msg = apiError?.response?.data?.message || apiError?.response?.data?.detail || t('auth.notifications.registerError');
      toast.error(t('auth.notifications.registerError'), { description: msg });
      setRegisterError(msg);
    } finally { setIsLoading(false); }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true); setForgotPasswordError('');
    try {
      let recaptchaToken: string | null = null;
      try { recaptchaToken = await executeRecaptcha('forgot_password'); } catch { recaptchaToken = null; }
      await forgotPassword({ email: data.email, recaptcha_token: recaptchaToken || undefined });
      toast.success(t('auth.forgotPassword.emailSent'));
      setActiveTab('login');
    } catch (error) {
      const apiError = error as ApiError & { response?: { status?: number; data?: { error?: string; message?: string; detail?: string; code?: string } } };
      const isServiceError = apiError?.response?.status === 503 || apiError?.response?.data?.code === 'email_delivery_failed';
      const msg = apiError?.response?.data?.error || apiError?.response?.data?.message || apiError?.response?.data?.detail || t('auth.notifications.forgotPasswordError');
      toast.error(isServiceError ? t('auth.forgotPassword.serviceUnavailable') : t('auth.notifications.forgotPasswordError'), { description: msg });
      setForgotPasswordError(msg);
    } finally { setIsLoading(false); }
  };

  const handleMfaVerification = async (code: string) => {
    await verifyMfaCode(code);
    const returnUrl = new URLSearchParams(location.search).get('returnUrl');
    if (returnUrl) window.location.href = returnUrl;
    else navigate('/', { replace: true });
  };

  const handleMfaResendEmailCode = async () => {
    if (mfaState?.method === 'email') await twoFactorService.sendEmailCode();
  };

  // ── MFA screen ──
  if (mfaState?.required) {
    return (
      <MfaVerification
        email={mfaState.email}
        method={mfaState.method}
        tempToken={mfaState.tempToken}
        onVerificationSuccess={handleMfaVerification}
        onResendEmailCode={mfaState.method === 'email' ? handleMfaResendEmailCode : undefined}
        onBack={() => { clearMfaState(); setIsLoading(false); }}
        isLoading={isLoading}
      />
    );
  }

  // ── Shared field style ──
  const fieldCls = 'space-y-1.5';
  const errorCls = 'text-red-400 text-xs mt-1';

  return (
    <div className="min-h-screen flex" style={{ background: '#0F0520' }}>
      {/* Left — brand panel (desktop only) */}
      <div className="relative lg:w-[55%] xl:w-[60%]">
        <LeftPanel />
      </div>

      {/* Right — form panel */}
      <div
        className="flex-1 flex flex-col min-h-screen relative"
        style={{ background: 'rgba(15,5,32,0.92)', borderLeft: '1px solid rgba(124,58,237,0.12)' }}
      >
        {/* Language picker */}
        <div className="absolute top-5 right-5 z-20">
          <Select value={currentLanguage} onValueChange={v => changeLanguage(v as Locale)}>
            <SelectTrigger className="h-8 gap-1.5 border-0 bg-white/5 text-white/60 text-xs hover:bg-white/10">
              <Globe className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">{t('language.selector.portuguese')}</SelectItem>
              <SelectItem value="en">{t('language.selector.english')}</SelectItem>
              <SelectItem value="es">{t('language.selector.spanish')}</SelectItem>
              <SelectItem value="fr">{t('language.selector.french')}</SelectItem>
              <SelectItem value="it">{t('language.selector.italian')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden pt-10 px-8">
          <AppLogo className="h-7" />
        </div>

        {/* Form area — centered */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">

            <AnimatePresence mode="wait">

              {/* ── LOGIN ── */}
              {activeTab === 'login' && (
                <motion.div key="login" variants={slideIn} initial="hidden" animate="visible" exit="exit">
                  <motion.div custom={0} variants={fadeUpVariant} initial="hidden" animate="visible" className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Entre na sua conta para continuar
                    </p>
                  </motion.div>

                  {loginError && (
                    <motion.div custom={0.5} variants={fadeUpVariant} initial="hidden" animate="visible">
                      <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('auth.errors.title')}</AlertTitle>
                        <AlertDescription>{loginError}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    {/* Email */}
                    <motion.div custom={1} variants={fadeUpVariant} initial="hidden" animate="visible" className={fieldCls}>
                      <Label htmlFor="login-email" className="text-white/70 text-sm">{t('auth.login.email')}</Label>
                      <Input
                        id="login-email" type="email" placeholder={t('auth.login.email')} disabled={isLoading}
                        autoComplete="username"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                        {...loginForm.register('email')}
                      />
                      {loginForm.formState.errors.email && (
                        <p className={errorCls}>{loginForm.formState.errors.email.message}</p>
                      )}
                    </motion.div>

                    {/* Senha — Controller garante que autopreenchimento do browser é rastreado */}
                    <motion.div custom={2} variants={fadeUpVariant} initial="hidden" animate="visible" className={fieldCls}>
                      <Label htmlFor="login-password" className="text-white/70 text-sm">{t('auth.login.password')}</Label>
                      <div className="relative">
                        <Controller
                          control={loginForm.control}
                          name="password"
                          render={({ field: f }) => (
                            <Input
                              id="login-password"
                              type={showLoginPass ? 'text' : 'password'}
                              placeholder={t('auth.login.password')}
                              disabled={isLoading}
                              autoComplete="current-password"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20 pr-10"
                              {...f}
                            />
                          )}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowLoginPass(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10"
                        >
                          {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className={errorCls}>{loginForm.formState.errors.password.message}</p>
                      )}
                    </motion.div>

                    <motion.div custom={3} variants={fadeUpVariant} initial="hidden" animate="visible" className="flex justify-between items-center">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                        />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Lembrar de mim</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('forgot')}
                        className="text-xs hover:text-violet-400 transition-colors"
                        style={{ color: 'rgba(167,100,250,0.7)' }}
                      >
                        {t('auth.login.forgotPasswordLink')}
                      </button>
                    </motion.div>

                    <motion.div custom={4} variants={fadeUpVariant} initial="hidden" animate="visible">
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: isLoading ? 1 : 1.02 }}
                        whileTap={{ scale: isLoading ? 1 : 0.97 }}
                        className="lmf-btn-shimmer w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {t('auth.login.signingIn')}
                          </>
                        ) : (
                          <>
                            {t('auth.login.signIn')}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>

                  {enableAccountSignup && (
                    <motion.p custom={5} variants={fadeUpVariant} initial="hidden" animate="visible"
                      className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Nao tem conta?{' '}
                      <button
                        onClick={() => setActiveTab('register')}
                        className="hover:text-violet-400 transition-colors"
                        style={{ color: 'rgba(167,100,250,0.7)' }}
                      >
                        Criar conta
                      </button>
                    </motion.p>
                  )}
                </motion.div>
              )}

              {/* ── REGISTER ── */}
              {activeTab === 'register' && enableAccountSignup && (
                <motion.div key="register" variants={slideIn} initial="hidden" animate="visible" exit="exit">
                  <motion.div custom={0} variants={fadeUpVariant} initial="hidden" animate="visible" className="mb-8">
                    <button
                      onClick={() => setActiveTab('login')}
                      className="flex items-center gap-1 text-xs mb-4 transition-colors"
                      style={{ color: 'rgba(167,100,250,0.7)' }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-1">{t('auth.register.title')}</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('auth.register.subtitle')}</p>
                  </motion.div>

                  {registerError && (
                    <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('auth.errors.title')}</AlertTitle>
                      <AlertDescription>{registerError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    {[
                      { i: 1, id: 'reg-name', type: 'text', label: t('auth.register.fullName'), field: 'fullName' as const },
                      { i: 2, id: 'reg-email', type: 'email', label: t('auth.register.email'), field: 'email' as const },
                      { i: 3, id: 'reg-pass', type: 'password', label: t('auth.register.password'), field: 'password' as const },
                      { i: 4, id: 'reg-confirm', type: 'password', label: t('auth.register.confirmPassword'), field: 'confirmPassword' as const },
                    ].map(({ i, id, type, label, field }) => (
                      <motion.div key={field} custom={i} variants={fadeUpVariant} initial="hidden" animate="visible" className={fieldCls}>
                        <Label htmlFor={id} className="text-white/70 text-sm">{label}</Label>
                        <Input
                          id={id} type={type} placeholder={label} disabled={isLoading}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/60"
                          {...registerForm.register(field)}
                        />
                        {registerForm.formState.errors[field] && (
                          <p className={errorCls}>{registerForm.formState.errors[field]?.message}</p>
                        )}
                      </motion.div>
                    ))}

                    <motion.div custom={5} variants={fadeUpVariant} initial="hidden" animate="visible">
                      <motion.button
                        type="submit" disabled={isLoading}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className="lmf-btn-shimmer w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isLoading ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('auth.register.registering')}</>
                        ) : (
                          <>{t('auth.register.createAccount')}<ArrowRight className="w-4 h-4" /></>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>
                </motion.div>
              )}

              {/* ── FORGOT PASSWORD ── */}
              {activeTab === 'forgot' && (
                <motion.div key="forgot" variants={slideIn} initial="hidden" animate="visible" exit="exit">
                  <motion.div custom={0} variants={fadeUpVariant} initial="hidden" animate="visible" className="mb-8">
                    <button
                      onClick={() => setActiveTab('login')}
                      className="flex items-center gap-1 text-xs mb-4 transition-colors"
                      style={{ color: 'rgba(167,100,250,0.7)' }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-1">{t('auth.forgotPassword.title')}</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('auth.forgotPassword.subtitle')}</p>
                  </motion.div>

                  {forgotPasswordError && (
                    <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('auth.errors.title')}</AlertTitle>
                      <AlertDescription>{forgotPasswordError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                    <motion.div custom={1} variants={fadeUpVariant} initial="hidden" animate="visible" className={fieldCls}>
                      <Label htmlFor="forgot-email" className="text-white/70 text-sm">{t('auth.forgotPassword.email')}</Label>
                      <Input
                        id="forgot-email" type="email" placeholder={t('auth.forgotPassword.email')} disabled={isLoading}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/60"
                        {...forgotPasswordForm.register('email')}
                      />
                      {forgotPasswordForm.formState.errors.email && (
                        <p className={errorCls}>{forgotPasswordForm.formState.errors.email.message}</p>
                      )}
                    </motion.div>

                    <motion.div custom={2} variants={fadeUpVariant} initial="hidden" animate="visible">
                      <motion.button
                        type="submit" disabled={isLoading}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className="lmf-btn-shimmer w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isLoading ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('auth.forgotPassword.sending')}</>
                        ) : (
                          <>{t('auth.forgotPassword.sendInstructions')}<ArrowRight className="w-4 h-4" /></>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Recaptcha notice */}
            <p className="text-center text-xs mt-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {t('auth.login.protectedByRecaptcha')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
