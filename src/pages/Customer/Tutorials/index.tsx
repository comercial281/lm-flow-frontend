// Tutorial LM Flow — Central de Conhecimento global (Docs + Aulas).
// Conteudo armazenado no Supabase do LM Hub (cpagtgvtvyenrabpacqc).
// Leitura publica via anon key; edicao restrita ao super-admin universal
// (comercial@lealmidia.com.br) via Edge Function `tutorial-admin`.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, GraduationCap } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import Aviso from '@/components/base/Aviso';
import Abas from '@/components/base/Abas';
import Carregando from '@/components/base/Carregando';
import { useLanguage } from '@/hooks/useLanguage';
import { useCategories } from '@/hooks/useKnowledge';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { LMHUB_CONFIGURED } from '@/lib/supabaseLmHub';
import { lazyWithRetry } from '@/utils/chunkReload';
import CategoriaSidebar from './_internal/CategoriaSidebar';

// Só uma aba (docs/aulas) renderiza por vez.
const DocsTab = lazyWithRetry(() => import('./tabs/DocsTab'));
const AulasTab = lazyWithRetry(() => import('./tabs/AulasTab'));

type Tab = 'docs' | 'aulas';

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'aulas', label: 'Aulas', icon: GraduationCap },
  { key: 'docs', label: 'Docs', icon: FileText },
];

const Tutorials = () => {
  const { t } = useLanguage('tutorials');
  const [params, setParams] = useSearchParams();
  const { data: categories = [] } = useCategories();
  const canEdit = useIsSuperAdmin();

  const [categoryId, setCategoryId] = useState<string | null>(params.get('cat'));
  const tabParam = (params.get('tab') as Tab) ?? 'aulas';
  const [tab, setTab] = useState<Tab>(
    TABS.some((x) => x.key === tabParam) ? tabParam : 'aulas',
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
        <div className="border-b border-border px-4 py-6 sm:px-6">
          <BaseHeader title={t('title')} />
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Aviso tom="atencao" titulo="Tutorial indisponível" className="max-w-md">
            As variáveis <code>VITE_LMHUB_SUPABASE_URL</code> e <code>VITE_LMHUB_SUPABASE_ANON_KEY</code> precisam ser configuradas no deploy do seu LM Flow.
          </Aviso>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 pt-6 sm:px-6">
        <BaseHeader title={t('title')} subtitle={t('description')} />
        {/* A linha de baixo das abas é a do próprio cabeçalho. */}
        <Abas
          rotulo="Partes dos Tutoriais"
          className="mt-4 border-b-0"
          ativa={tab}
          aoTrocar={chave => setTab(chave as Tab)}
          abas={TABS.map(x => ({ chave: x.key, rotulo: x.label, icone: x.icon }))}
        />
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
        <Suspense
          fallback={
            <Carregando variante="texto" linhas={6} className="flex-1 p-6" />
          }
        >
          {tab === 'docs' && <DocsTab categoryId={categoryId} canEdit={canEdit} />}
          {tab === 'aulas' && <AulasTab canEdit={canEdit} />}
        </Suspense>
      </div>
    </div>
  );
};

export default Tutorials;
