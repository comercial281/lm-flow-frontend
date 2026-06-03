// Cliente Supabase secundario: aponta pro projeto Supabase do LM Hub
// (cpagtgvtvyenrabpacqc) que armazena o conteudo GLOBAL do Tutorial.
// Eh independente do supabase do LM Flow (que nao existe — aqui Auth eh Rails).
//
// Leitura: anon key + RLS publico (policy `anon SELECT` ativada em
// 20260603_tutorial_lmflow_anon_select).
// Escrita: passa pela Edge Function `tutorial-admin` (ver useKnowledge.ts).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_LMHUB_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_LMHUB_SUPABASE_ANON_KEY as string | undefined;

export const LMHUB_SUPABASE_URL = url ?? '';
export const LMHUB_SUPABASE_ANON_KEY = anonKey ?? '';

export const LMHUB_CONFIGURED = Boolean(url && anonKey);

export const supabaseLmHub: SupabaseClient = createClient(
  url ?? 'https://invalid.invalid',
  anonKey ?? 'invalid',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
