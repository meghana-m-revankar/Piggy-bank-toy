// Tiny synth: no audio files needed.
let actx: AudioContext | null = null;

export function unlockAudio() {
  actx ??= new AudioContext();
  if (actx.state === "suspended") void actx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(dur: number, vol: number, freq: number) {
  if (!actx) return;
  const t = actx.currentTime;
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf;
  const f = actx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(actx.destination);
  src.start(t);
}

// pitch climbs as the pig fills up
export const sfxTick = () => tone(2400, 0.03, "triangle", 0.04);
export const sfxClink = (fill: number) => {
  const base = 1300 + fill * 55;
  tone(base, 0.14, "triangle", 0.16);
  tone(base * 2.76, 0.09, "sine", 0.07);
  tone(170, 0.16, "sine", 0.18, 90); // hollow ceramic thunk
};
export const sfxWhoosh = () => noise(0.28, 0.12, 900);
export const sfxSmash = () => {
  noise(0.6, 0.5, 2200);
  noise(0.35, 0.4, 600);
  tone(90, 0.45, "sine", 0.5, 28);
};
export const sfxBounce = () => tone(2000 + Math.random() * 1200, 0.05, "triangle", 0.045);
