import React, { useState } from 'react';
import { Input, Label } from '@/components/ui/ds';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/services/core/api';
import { AppLogo } from '@/components/AppLogo';
import FlowBackground from './FlowBackground';

const PROD_DOMAIN = 'lmflow.com.br';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const schema = z.object({
  companyName: z.string().min(2, { message: 'Informe o nome da imobiliária' }),
  slug: z.string().min(3, { message: 'Mínimo 3 caracteres' })
    .regex(/^[a-z0-9-]+$/, { message: 'Só minúsculas, números e hífen' }),
  adminName: z.string().min(2, { message: 'Informe seu nome' }),
  email: z.string().min(1, { message: 'Informe o e-mail' }).email({ message: 'E-mail inválido' }),
  password: z.string().min(8, { message: 'Mínimo 8 caracteres' }),
});
type FormData = z.infer<typeof schema>;

const fieldCls = 'space-y-1.5';
const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20';
const errorCls = 'text-red-400 text-xs mt-1';

export const SaasSignup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState<{ slug: string; loginUrl: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', slug: '', adminName: '', email: '', password: '' },
  });

  const slug = form.watch('slug');

  const onCompanyChange = (v: string) => {
    form.setValue('companyName', v);
    if (!slugTouched) form.setValue('slug', slugify(v), { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true); setServerError('');
    try {
      const res = await api.post('/saas/signup', {
        company_name: data.companyName,
        slug: data.slug,
        admin_name: data.adminName,
        admin_email: data.email,
        password: data.password,
      });
      const body = res.data || {};
      setDone({ slug: data.slug, loginUrl: body.login_url || `https://${data.slug}.${PROD_DOMAIN}` });
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: string; errors?: string[] } } };
      const data = e.response?.data;
      if (e.response?.status === 403) {
        setServerError('O cadastro online ainda não está aberto. Fale com a Leal Mídia.');
      } else {
        setServerError(data?.error || data?.errors?.join(', ') || 'Não foi possível criar a conta. Tente outro endereço.');
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0F0520' }}>
      {/* Esquerda — marca */}
      <div className="relative lg:w-[55%] xl:w-[60%] hidden lg:block">
        <div className="relative flex flex-col justify-between h-full px-12 py-10 overflow-hidden">
          <FlowBackground />
          <div className="relative z-10"><AppLogo className="h-8" /></div>
          <div className="relative z-10 space-y-6">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: 'rgba(167,100,250,0.8)' }}>
              CRM Imobiliário
            </p>
            <h1 className="text-4xl font-bold leading-tight text-white">
              Sua imobiliária<br /><span style={{ color: '#c084fc' }}>no piloto automático.</span>
            </h1>
            <div className="flex flex-col gap-3">
              {['Teste grátis por 14 dias', 'Seu próprio endereço .lmflow.com.br', 'Leads, WhatsApp e follow-up num lugar só'].map(label => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#9333ea', boxShadow: '0 0 6px #9333ea' }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Leal Mídia &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      {/* Direita — formulário */}
      <div className="flex-1 flex flex-col min-h-screen relative" style={{ background: 'rgba(15,5,32,0.92)', borderLeft: '1px solid rgba(124,58,237,0.12)' }}>
        <div className="lg:hidden pt-10 px-8"><AppLogo className="h-7" /></div>
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">

            {done ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#c084fc' }} />
                <h2 className="text-2xl font-bold text-white mb-2">Conta criada! 🎉</h2>
                <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Seu endereço é
                </p>
                <p className="text-sm font-semibold mb-6" style={{ color: '#c084fc' }}>
                  {done.slug}.{PROD_DOMAIN}
                </p>
                <a
                  href={done.loginUrl}
                  className="lmf-btn-shimmer inline-flex w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white items-center justify-center gap-2"
                >
                  Entrar no meu painel <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-1">Criar minha conta</h2>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>14 dias grátis. Sem cartão.</p>
                </div>

                {serverError && (
                  <div className="mb-5 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{serverError}</p>
                  </div>
                )}

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className={fieldCls}>
                    <Label htmlFor="su-company" className="text-white/70 text-sm">Nome da imobiliária</Label>
                    <Input id="su-company" placeholder="Imobiliária Exemplo" disabled={isLoading} className={inputCls}
                      value={form.watch('companyName')} onChange={e => onCompanyChange(e.target.value)} />
                    {form.formState.errors.companyName && <p className={errorCls}>{form.formState.errors.companyName.message}</p>}
                  </div>

                  <div className={fieldCls}>
                    <Label htmlFor="su-slug" className="text-white/70 text-sm">Seu endereço</Label>
                    <div className="flex items-center rounded-md bg-white/5 border border-white/10 focus-within:border-violet-500/60">
                      <input id="su-slug" disabled={isLoading}
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none"
                        placeholder="minha-imobiliaria"
                        {...form.register('slug')}
                        onChange={e => { setSlugTouched(true); form.setValue('slug', slugify(e.target.value), { shouldValidate: true }); }}
                      />
                      <span className="px-3 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>.{PROD_DOMAIN}</span>
                    </div>
                    {form.formState.errors.slug
                      ? <p className={errorCls}>{form.formState.errors.slug.message}</p>
                      : slug && <p className="text-xs mt-1" style={{ color: 'rgba(167,100,250,0.7)' }}>{slug}.{PROD_DOMAIN}</p>}
                  </div>

                  <div className={fieldCls}>
                    <Label htmlFor="su-name" className="text-white/70 text-sm">Seu nome</Label>
                    <Input id="su-name" placeholder="João Silva" disabled={isLoading} className={inputCls} {...form.register('adminName')} />
                    {form.formState.errors.adminName && <p className={errorCls}>{form.formState.errors.adminName.message}</p>}
                  </div>

                  <div className={fieldCls}>
                    <Label htmlFor="su-email" className="text-white/70 text-sm">E-mail</Label>
                    <Input id="su-email" type="email" placeholder="voce@imobiliaria.com.br" disabled={isLoading} className={inputCls} {...form.register('email')} />
                    {form.formState.errors.email && <p className={errorCls}>{form.formState.errors.email.message}</p>}
                  </div>

                  <div className={fieldCls}>
                    <Label htmlFor="su-pass" className="text-white/70 text-sm">Senha</Label>
                    <Input id="su-pass" type="password" placeholder="Mínimo 8 caracteres" disabled={isLoading} className={inputCls} {...form.register('password')} />
                    {form.formState.errors.password && <p className={errorCls}>{form.formState.errors.password.message}</p>}
                  </div>

                  <motion.button type="submit" disabled={isLoading}
                    whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.97 }}
                    className="lmf-btn-shimmer w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isLoading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Criando...</>
                      : <>Criar conta grátis <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                </form>

                <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Já tem conta? Entre no seu endereço <span style={{ color: 'rgba(167,100,250,0.7)' }}>seu-nome.{PROD_DOMAIN}</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaasSignup;
