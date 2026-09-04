import { describe, it, expect } from 'vitest';
import {
  effectivePixelId,
  readPixelSettings,
  writePixelSettings,
  type PixelForm,
} from './landingPixel';

// O que estes exemplos protegem é a landing JÁ PUBLICADA continuar disparando o
// que dispara hoje. Antes desta leva os eventos eram quatro caixinhas e os nomes
// viviam dentro do código da página; agora o gestor escolhe o nome, e a janela
// abre pré-preenchida com o que estava valendo. Trocar o nome de um evento em
// produção zera o aprendizado da campanha que roda em cima dele.
describe('rastreio da landing — o que já está gravado', () => {
  it('traduz as caixinhas antigas nos mesmos nomes que a página disparava', () => {
    const form = readPixelSettings({
      pixel_id: '123',
      events: { page_view: true, lead: true, qualified: true, disqualified: false },
    });

    expect(form.mode).toBe('custom');
    expect(form.pixelId).toBe('123');
    expect(form.submitEvent).toBe('Lead');
    expect(form.qualifiedEvent).toBe('LeadQualificado');
    // A caixinha do desqualificado nascia DESMARCADA.
    expect(form.disqualifiedEvent).toBe('');
  });

  it('respeita a caixinha do envio desmarcada', () => {
    const form = readPixelSettings({ pixel_id: '123', events: { lead: false } });

    expect(form.submitEvent).toBe('');
    expect(form.qualifiedEvent).toBe('LeadQualificado');
  });

  // "Campo do pixel vazio" sempre significou "não rastreia". Virar isso em
  // "usa o pixel do CRM" ligaria rastreio em landing que ninguém configurou.
  it('landing sem pixel nenhum continua sem rastreio', () => {
    expect(readPixelSettings(undefined).mode).toBe('off');
    expect(readPixelSettings({}).mode).toBe('off');
  });

  it('lê o formato novo como está, sem inventar padrão', () => {
    const form = readPixelSettings({
      mode: 'crm',
      events: { page_view: false, submit_event: 'Lead', qualified_event: null, disqualified_event: '' },
    });

    expect(form.mode).toBe('crm');
    expect(form.pageView).toBe(false);
    expect(form.submitEvent).toBe('Lead');
    expect(form.qualifiedEvent).toBe('');
    expect(form.disqualifiedEvent).toBe('');
  });
});

describe('o que a janela grava', () => {
  const base: PixelForm = {
    mode: 'crm', pixelId: '', pageView: true,
    submitEvent: 'Lead', qualifiedEvent: '', disqualifiedEvent: '',
  };

  it('grava sempre o formato novo, explícito', () => {
    expect(writePixelSettings(base)).toEqual({
      mode: 'crm',
      pixel_id: null,
      events: {
        page_view: true, submit_event: 'Lead',
        qualified_event: null, disqualified_event: null,
      },
    });
  });

  // Ida e volta sem mexer em nada não pode mudar o que a landing dispara.
  it('não muda os eventos ao abrir e salvar uma landing antiga', () => {
    const antiga = { pixel_id: '123', events: { page_view: true, lead: true, qualified: true } };
    const salvo = writePixelSettings(readPixelSettings(antiga));
    const relido = readPixelSettings(salvo);

    expect(relido.submitEvent).toBe('Lead');
    expect(relido.qualifiedEvent).toBe('LeadQualificado');
    expect(relido.disqualifiedEvent).toBe('');
    expect(relido.pixelId).toBe('123');
  });

  it('só guarda o ID digitado no modo "outro pixel"', () => {
    expect(writePixelSettings({ ...base, mode: 'crm', pixelId: '999' }).pixel_id).toBeNull();
    expect(writePixelSettings({ ...base, mode: 'custom', pixelId: ' 999 ' }).pixel_id).toBe('999');
  });
});

// É o pixel EFETIVO que o botão "Testar conexão" pergunta à Meta — testar o que
// está digitado num campo escondido responderia sobre outro conjunto.
describe('qual pixel vai ser usado', () => {
  const form: PixelForm = {
    mode: 'crm', pixelId: '111', pageView: true,
    submitEvent: 'Lead', qualifiedEvent: '', disqualifiedEvent: '',
  };

  it('herda o do CRM no modo "Pixel do CRM"', () => {
    expect(effectivePixelId(form, '999')).toBe('999');
  });

  it('usa o da landing no modo "outro pixel"', () => {
    expect(effectivePixelId({ ...form, mode: 'custom' }, '999')).toBe('111');
  });

  it('não devolve nada com o rastreio desligado', () => {
    expect(effectivePixelId({ ...form, mode: 'off' }, '999')).toBe('');
  });

  it('não devolve nada quando o CRM ainda não tem pixel cadastrado', () => {
    expect(effectivePixelId(form, null)).toBe('');
  });
});
