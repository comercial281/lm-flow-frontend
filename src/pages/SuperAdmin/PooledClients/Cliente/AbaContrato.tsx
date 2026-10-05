// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { groupJidsFrom, groupsPatch } from '../clientGroups';
import type { PropsDaAba } from './Pagina';

// Contrato do cliente. 3A: os três limites (números de WhatsApp, franquia de
// leads da IA, preço do excedente). O PATCH reenvia os grupos de WhatsApp: o
// servidor faz compact! nessas chaves e uma omissão apagaria os grupos.
const INTEIRO = /^\d+$/;
const DECIMAL = /^\d+([.,]\d+)?$/;

export default function AbaContrato({ cliente, aoMudar }: PropsDaAba) {
  // `key` pelos limites: se o cliente mudar por fora (ex.: troca de pacote), os campos recomeçam dele.
  const chave = `${cliente.max_whatsapp_channels}|${cliente.ai_leads_included}|${cliente.ai_lead_overage_price_brl}`;
  return <FormularioDeLimites key={chave} cliente={cliente} aoMudar={aoMudar} />;
}

function FormularioDeLimites({ cliente, aoMudar }: Pick<PropsDaAba, 'cliente' | 'aoMudar'>) {
  const [numeros, setNumeros] = useState(String(cliente.max_whatsapp_channels ?? 5));
  const [franquia, setFranquia] = useState(cliente.ai_leads_included == null ? '' : String(cliente.ai_leads_included));
  const [preco, setPreco] = useState(String(cliente.ai_lead_overage_price_brl ?? 2.49));
  const [salvando, setSalvando] = useState(false);

  // Só "0" literal é ilimitado: vazio ou inválido nunca vira 0.
  const erroNumeros = INTEIRO.test(numeros.trim()) ? null : 'Digite um número inteiro (0 = ilimitado).';
  const erroFranquia = franquia.trim() === '' || INTEIRO.test(franquia.trim()) ? null : 'Deixe vazio ou digite um número inteiro.';
  const erroPreco = DECIMAL.test(preco.trim()) ? null : 'Digite um valor, como 2,49.';
  const invalido = !!(erroNumeros || erroFranquia || erroPreco);

  const salvar = async () => {
    if (invalido) return;
    setSalvando(true);
    try {
      const atualizado = await clientesService.atualizar(cliente.id, {
        name: cliente.name,
        ...groupsPatch(groupJidsFrom(cliente.settings ?? {})),
        max_whatsapp_channels: parseInt(numeros.trim(), 10),
        ai_leads_included: franquia.trim() === '' ? null : parseInt(franquia.trim(), 10),
        ai_lead_overage_price_brl: parseFloat(preco.trim().replace(',', '.')),
      });
      aoMudar({ ...cliente, ...atualizado });
      toast.success('Limites salvos.');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  const msg = (id: string, t: string | null) => t ? <p id={id} className="mt-1 text-xs text-destructive">{t}</p> : null;

  return (
    <section aria-labelledby="limites" className="max-w-xl rounded-lg border p-4">
      <h2 id="limites" className="mb-3 text-sm font-semibold">Limites</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="lim-num">Números de WhatsApp</Label>
          <Input id="lim-num" inputMode="numeric" aria-invalid={!!erroNumeros} aria-describedby={erroNumeros ? 'lim-num-erro' : undefined} value={numeros} onChange={(e) => setNumeros(e.target.value)} />
          {msg('lim-num-erro', erroNumeros)}
          <p className="mt-1 text-xs text-muted-foreground">0 = ilimitado · em uso: {cliente.whatsapp_channels_used ?? '—'}</p></div>
        <div><Label htmlFor="lim-fr">Franquia de leads da IA</Label>
          <Input id="lim-fr" inputMode="numeric" placeholder="sem franquia" aria-invalid={!!erroFranquia} aria-describedby={erroFranquia ? 'lim-fr-erro' : undefined} value={franquia} onChange={(e) => setFranquia(e.target.value)} />
          {msg('lim-fr-erro', erroFranquia)}</div>
        <div><Label htmlFor="lim-pr">Preço do excedente (R$)</Label>
          <Input id="lim-pr" inputMode="decimal" aria-invalid={!!erroPreco} aria-describedby={erroPreco ? 'lim-pr-erro' : undefined} value={preco} onChange={(e) => setPreco(e.target.value)} />
          {msg('lim-pr-erro', erroPreco)}</div>
      </div>
      <Button className="mt-3" disabled={salvando || invalido} onClick={() => void salvar()}>Salvar limites</Button>
    </section>
  );
}
