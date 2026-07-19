import { useEffect, useState } from 'react';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import superLogsService from '@/services/superLogs/superLogsService';

// Acesso à ÁREA DO ADMIN. Diferente de useIsSuperAdmin (que é o DONO por e-mail,
// usado pra features do CRM): aqui o dono passa instantâneo E a equipe cadastrada
// (InternalMember.can_access_admin) passa via /super/whoami.
//
// Só o gate da Área do Admin usa isto — não mexer no useIsSuperAdmin, que gateia
// outras coisas por e-mail de propósito.

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function fetchIsAdmin(): Promise<boolean> {
  inflight ??= superLogsService
    .whoami()
    .then(r => {
      cached = !!r.data.data.is_admin;
      return cached;
    })
    .catch(() => {
      // não cacheia falha (pode ser 401 transitório no boot); tenta de novo depois
      inflight = null;
      return false;
    });
  return inflight;
}

export interface AdminAccess {
  loading: boolean;
  isAdmin: boolean;
}

export function useAdminAccess(): AdminAccess {
  const isOwner = useIsSuperAdmin(); // dono por e-mail — instantâneo, nunca depende de rede
  const [state, setState] = useState<AdminAccess>(() =>
    isOwner
      ? { loading: false, isAdmin: true }
      : cached !== null
        ? { loading: false, isAdmin: cached }
        : { loading: true, isAdmin: false },
  );

  useEffect(() => {
    if (isOwner) {
      setState({ loading: false, isAdmin: true });
      return;
    }
    if (cached !== null) {
      setState({ loading: false, isAdmin: cached });
      return;
    }
    let alive = true;
    fetchIsAdmin().then(ok => {
      if (alive) setState({ loading: false, isAdmin: ok });
    });
    return () => {
      alive = false;
    };
  }, [isOwner]);

  return state;
}
