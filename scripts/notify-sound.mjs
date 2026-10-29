// Synthesizes Lumen's notification sound: a bubbly "bloop" that pops up into a quick
// marimba arpeggio with a sparkle on top. Writes 16-bit mono WAV to each path given.
//   node scripts/notify-sound.mjs ../desktop/public/sounds/notify.wav ../mobile/assets/sounds/notify.wav

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const RATE = 44100;
const LENGTH = 0.95;
const out = new Float32Array(Math.ceil(RATE * LENGTH));

/** Adds a voice: `freq(t)` in Hz, `env(t)` 0..1, over [start, start + dur) seconds. */
function voice(start, dur, freq, env, partials = [[1, 1]]) {
  let phase = 0;
  const from = Math.floor(start * RATE);
  for (let i = 0; i < dur * RATE && from + i < out.length; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * freq(t)) / RATE;
    let s = 0;
    for (const [mult, amp] of partials) s += amp * Math.sin(phase * mult);
    out[from + i] += s * env(t);
  }
}

const decay = (k, attack = 0.004) => (t) => Math.min(1, t / attack) * Math.exp(-k * t);

// 1. The bloop: a sine that slides up an octave, like a bubble popping.
voice(0, 0.16, (t) => 300 * Math.pow(2, Math.min(1, t / 0.09) * 1.3), decay(16, 0.006), [[1, 0.55], [2, 0.12]]);

// 2. Marimba arpeggio (C6 E6 G6 C7): wooden partials at 1x and 4x, fast decay.
const marimba = [[1, 0.5], [4, 0.14], [9.2, 0.04]];
[1046.5, 1318.5, 1568.0, 2093.0].forEach((f, i) => voice(0.11 + i * 0.075, 0.6, () => f, decay(9 + i), marimba));

// 3. Sparkle: two faint high bells that shimmer a moment later.
voice(0.43, 0.5, (t) => 4186 * (1 + 0.004 * Math.sin(2 * Math.PI * 7 * t)), decay(10), [[1, 0.08]]);
voice(0.5, 0.45, () => 5274, decay(12), [[1, 0.05]]);

// Gentle limiter and a short fade so it never clicks.
const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const pcm = Buffer.alloc(44 + out.length * 2);
out.forEach((v, i) => {
  const fade = Math.min(1, (out.length - i) / (RATE * 0.05));
  pcm.writeInt16LE(Math.round((v / peak) * 0.82 * fade * 32767), 44 + i * 2);
});
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + out.length * 2, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); // PCM
pcm.writeUInt16LE(1, 22); // mono
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(out.length * 2, 40);

for (const path of process.argv.slice(2)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, pcm);
  console.log(`wrote ${path} (${(pcm.length / 1024).toFixed(0)} KB)`);
}
