// Tutorial LM Flow — Central de Conhecimento global (Docs + Aulas).
// Conteudo armazenado no Supabase do LM Hub (cpagtgvtvyenrabpacqc).
// Leitura publica via anon key; edicao restrita ao super-admin universal
// (comercial@lealmidia.com.br) via Edge Function `tutorial-admin`.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, FileText, GraduationCap, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { useCategories } from '@/hooks/useKnowledge';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { LMHUB_CONFIGURED } from '@/lib/supabaseLmHub';
import CategoriaSidebar from './_internal/CategoriaSidebar';
import DocsTab from './tabs/DocsTab';
import AulasTab from './tabs/AulasTab';

type Tab = 'docs' | 'aulas';

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'docs', label: 'Docs', icon: FileText },
  { key: 'aulas', label: 'Aulas', icon: GraduationCap },
];

const Tutorials = () => {
  const { t } = useLanguage('tutorials');
  const [params, setParams] = useSearchParams();
  const { data: categories = [] } = useCategories();
  const canEdit = useIsSuperAdmin();

  const [categoryId, setCategoryId] = useState<string | null>(params.get('cat'));
  const tabParam = (params.get('tab') as Tab) ?? 'docs';
  const [tab, setTab] = useState<Tab>(
    TABS.some((x) => x.key === tabParam) ? tabParam : 'docs',
  );

  // Default: primeira categoria quando carrega
  useEffect(() => {
    if (categoryId === null && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Sync URL
  useEffect(() => {
    const next: Record<string, string> = { tab };
    if (categoryId) next.cat = categoryId;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, categoryId]);

  if (!LMHUB_CONFIGURED) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <BookOpen size={22} className="text-primary" />
            <h1 className="text-xl font-bold">{t('title')}</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md bg-card border border-orange-500/40 rounded-xl p-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Tutorial indisponivel</p>
              <p className="text-muted-foreground text-xs">
                As variaveis <code>VITE_LMHUB_SUPABASE_URL</code> e{' '}
                <code>VITE_LMHUB_SUPABASE_ANON_KEY</code> precisam ser configuradas no deploy
                deste tenant.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={22} className="text-primary" />
          <h1 className="text-xl font-bold">{t('title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {TABS.map((x) => {
            const Icon = x.icon;
            const active = tab === x.key;
            return (
              <button
                key={x.key}
                onClick={() => setTab(x.key)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-primary/15 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
                type="button"
              >
                <Icon size={13} />
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {tab === 'docs' && (
          <CategoriaSidebar
            selectedId={categoryId}
            onSelect={setCategoryId}
            canEdit={canEdit}
          />
        )}
        {tab === 'docs' && <DocsTab categoryId={categoryId} canEdit={canEdit} />}
        {tab === 'aulas' && <AulasTab canEdit={canEdit} />}
      </div>
    </div>
  );
};

export default Tutorials;
