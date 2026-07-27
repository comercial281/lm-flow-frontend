// Rota fullscreen /academia — home da área de membros.

import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import AcademiaShell from './AcademiaShell';
import AcademiaHome from './AcademiaHome';

export default function AcademiaHomePage() {
  const canEdit = useIsSuperAdmin();
  return (
    <AcademiaShell>
      <AcademiaHome canEdit={canEdit} />
    </AcademiaShell>
  );
}
