import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateRule } from './LeadAutomationsEditors';
import { SEND_FROM_NEEDS_NUMBER } from '@/features/numbers/sendFrom';

// "Enviar pelo número" e o aviso de nome fixo na ação de mensagem (fase 2b.2).
// A regra (validar a escolha) é testada de verdade; a ligação na tela (~1.400
// linhas, meia dúzia de serviços) é conferida no código-fonte.
const semComentarios = (bruto: string) => bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const editores = semComentarios(readFileSync(resolve(__dirname, 'LeadAutomationsEditors.tsx'), 'utf8'));
const pagina = semComentarios(readFileSync(resolve(__dirname, 'LeadAutomations.tsx'), 'utf8'));

const mensagem = (params: Record<string, string>) => [{ type: 'send_whatsapp_message', params: { message: 'Oi', ...params } }];

describe('validar a escolha do número', () => {
  // "um número específico" sem o número só chega por API/importação (a tela não
  // produz): vale o padrão, igual ao servidor — senão o salvar travaria sem
  // ter o que escolher (revisão final da 2b.2).
  it('"um número específico" sem o número vale o automático e salva', () => {
    expect(validateRule('lead.created', [], mensagem({ send_from: 'number', send_from_inbox_id: '' })).ok).toBe(true);
    expect(SEND_FROM_NEEDS_NUMBER).toBeTruthy();
  });

  it('com o número, com o do responsável ou no automático, salva', () => {
    expect(validateRule('lead.created', [], mensagem({ send_from: 'number', send_from_inbox_id: 'i1' })).ok).toBe(true);
    expect(validateRule('lead.created', [], mensagem({ send_from: 'owner' })).ok).toBe(true);
    expect(validateRule('lead.created', [], mensagem({})).ok).toBe(true);
  });
});

describe('a ação de mensagem', () => {
  it('ganha o campo "Enviar pelo número"', () => {
    expect(editores).toContain('<SendFromField');
    expect(editores).toContain('scope="lead_automation_rules"');
    expect(editores).toContain('applySendFrom(params, v)');
  });

  // E26: a "Instância de envio (admin)" só aparece no automático.
  it('o campo do admin só aparece no automático', () => {
    expect(editores).toContain('!envio.send_from');
  });

  // E39: o nome fixo da equipe no texto vira aviso (não barra).
  it('avisa quando a mensagem tem o nome de alguém da equipe', () => {
    expect(editores).toContain("teamNameWarning(String(params.message ?? ''), resources.users)");
    expect(editores).toContain('{avisoNome && <p className="text-xs text-amber-600 mt-1">{avisoNome}</p>}');
  });

  // E33: o aviso do servidor aparece depois de salvar, criando e editando.
  it('o salvar mostra os avisos do servidor', () => {
    expect(pagina).toContain('avisar(sendFromWarnings(updated))');
    expect(pagina).toContain('avisar(sendFromWarnings(created))');
    expect(pagina).toContain('toast.warning(aviso, { duration: SEND_FROM_WARNING_MS })');
  });
});
