import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/ds';
import numbersService from '@/services/numbers/numbersService';
import { useNumberOwnerRule } from '@/features/numbers/useNumberOwnerRule';
import {
  MY_NUMBERS_DESCRIPTION, NO_OWNED_NUMBERS_SELF, NUMBERS_TITLE, PRIMARY_DONE, PRIMARY_FAILED, PRIMARY_HINT_SELF,
} from '@/features/numbers/numberTexts';
import type { MyNumbers } from '@/features/numbers/types';
import { apiErrorMessage } from '@/utils/apiHelpers';
import OwnedNumbersList from './OwnedNumbersList';

/* O bloco "Números de atendimento" do Perfil (fase 2b.1). Carrega sozinho.
   Leitura de fundo NÃO grita: servidor antigo, cargo ou rede só escondem o
   bloco. E sem a regra ele não existe — sem ela "o número é seu" não decide
   nada, e a tela não pode prometer que decide. */
export default function MyNumbersCard() {
  const [data, setData] = useState<MyNumbers | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    numbersService
      .myNumbers()
      .then(resposta => { if (vivo) setData(resposta); })
      .catch(() => { if (vivo) setData(null); });
    return () => { vivo = false; };
  }, []);

  const rule = useNumberOwnerRule(data?.number_owner_rule ?? null);
  if (!data || !rule) return null;

  const escolher = async (inboxId: string) => {
    setBusyId(inboxId);
    try {
      setData(await numbersService.setMyPrimary(inboxId));
      toast.success(PRIMARY_DONE);
    } catch (error) {
      toast.error(apiErrorMessage(error, PRIMARY_FAILED));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" /> {NUMBERS_TITLE}
        </CardTitle>
        <CardDescription>{MY_NUMBERS_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent>
        <OwnedNumbersList
          numbers={data.numbers}
          canChoosePrimary
          busyId={busyId}
          onChoosePrimary={escolher}
          emptyText={NO_OWNED_NUMBERS_SELF}
          hint={PRIMARY_HINT_SELF}
        />
      </CardContent>
    </Card>
  );
}
