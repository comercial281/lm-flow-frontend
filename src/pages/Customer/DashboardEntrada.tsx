// src/pages/Customer/DashboardEntrada.tsx
import React from 'react';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import DashboardV2 from '@/pages/Customer/DashboardV2';
import DashboardNova from '@/pages/Customer/DashboardNova';

/**
 * /dashboard: a Dashboard nova só onde a Leal Mídia ligou a chave
 * `dashboard_nova` (painel raiz → Funções). Sem a chave, a de sempre.
 * Temporário: o PR 5 da jornada liga para todos e apaga este arquivo.
 *
 * `useClientToggle` (e não `useFeature`): liga só com `true` explícito. A chave
 * está em ClientInstance::DEFAULT_OFF_FEATURES no backend.
 */
const DashboardEntrada: React.FC = () => (useClientToggle('dashboard_nova') ? <DashboardNova /> : <DashboardV2 />);

export default DashboardEntrada;
