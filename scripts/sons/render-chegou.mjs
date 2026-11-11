// Gera o som "Chegou" do Modo Plantão (escolhido pelo dono do produto em
// 11/11/2026 entre quatro opções). Reproduz, nota por nota, o cartão "Chegou"
// da prévia: duas notas subindo (Sol5 → Ré6) em timbre de sino, o par tocado
// duas vezes.
//
// Uso: node scripts/sons/render-chegou.mjs /tmp/chegou.wav
//      ffmpeg -y -i /tmp/chegou.wav -ac 1 -codec:a libmp3lame -b:a 128k public/audio/notifications/chegou.mp3
import { writeFileSync } from 'node:fs';

const RATE = 44100;
const DURACAO = 1.6;
const GANHO = 0.55;
const ATAQUE = 0.004;
// [razão da frequência, amplitude, fator de duração] de cada parcial do sino.
const SINO = [
  [1, 1, 1],
  [2, 0.45, 0.6],
  [3, 0.22, 0.4],
  [4.2, 0.1, 0.25],
];
// [início em s, frequência em Hz, duração em s]
const NOTAS = [0, 0.48].flatMap((o) => [
  [o, 784, 0.9],
  [o + 0.14, 1175, 1.0],
]);

const total = Math.round(RATE * DURACAO);
const amostras = new Float64Array(total);

for (const [inicio, freq, dur] of NOTAS) {
  for (const [razao, amp, fator] of SINO) {
    const fim = dur * fator;
    const i0 = Math.round(inicio * RATE);
    const n = Math.min(Math.round(fim * RATE), total - i0);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      // ataque linear curto e queda exponencial até ~-80 dB no fim da parcial
      const env = t < ATAQUE ? t / ATAQUE : Math.exp((-9.2 * (t - ATAQUE)) / (fim - ATAQUE));
      amostras[i0 + i] += GANHO * amp * env * Math.sin(2 * Math.PI * freq * razao * t);
    }
  }
}

// Saturação leve (faz o papel do compressor da prévia) e pico em -1 dBFS.
let pico = 0;
for (let i = 0; i < total; i++) {
  amostras[i] = Math.tanh(1.5 * amostras[i]);
  pico = Math.max(pico, Math.abs(amostras[i]));
}
const alvo = 10 ** (-1 / 20);
const pcm = Buffer.alloc(44 + total * 2);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + total * 2, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(total * 2, 40);
for (let i = 0; i < total; i++) {
  pcm.writeInt16LE(Math.round((amostras[i] / pico) * alvo * 32767), 44 + i * 2);
}

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node scripts/sons/render-chegou.mjs <arquivo.wav>');
  process.exit(1);
}
writeFileSync(destino, pcm);
console.log(`ok: ${destino} (${DURACAO}s, pico -1 dBFS)`);
