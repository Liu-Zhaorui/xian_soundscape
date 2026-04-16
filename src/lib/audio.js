export function createWaveBlob(soundConfig, options = {}) {
  const sampleRate = 44100;
  const duration = options.duration ?? 14;
  const frameCount = duration * sampleRate;
  const blockAlign = 2;
  const buffer = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(buffer);
  const random = mulberry32((soundConfig?.seed ?? 0.3) + (options.offset ?? 0));

  const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, frameCount * blockAlign, true);

  const profiles = {
    nocturne: [174, 246, 329],
    bell: [392, 523, 783],
    wind: [96, 144, 216],
    water: [110, 165, 220],
    steps: [120, 180, 260],
    harbor: [73, 110, 220],
    horn: [98, 196, 294],
    bridge: [60, 90, 180],
    rainstreet: [160, 240, 360],
    garden: [220, 294, 392],
    mist: [196, 247, 330],
    boat: [147, 220, 294],
    shade: [185, 247, 277],
  };
  const profile = profiles[soundConfig?.color] ?? profiles.nocturne;

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const progress = i / frameCount;
    const envelope = Math.min(progress * 4, 1) * Math.min((1 - progress) * 1.3 + 0.08, 1);
    const noise = (random() * 2 - 1) * 0.18;
    const pulse = soundConfig?.color === "steps" || soundConfig?.color === "boat"
      ? Math.sin(2 * Math.PI * 1.8 * t) > 0.82 ? 0.65 : 0
      : 0;
    const wash = ["wind", "mist", "rainstreet"].includes(soundConfig?.color) ? noise * 0.8 : noise * 0.25;
    const bell = ["bell", "horn"].includes(soundConfig?.color) ? Math.sin(2 * Math.PI * 0.32 * t) * 0.4 : 0;
    let sample =
      Math.sin(2 * Math.PI * profile[0] * t) * 0.3 +
      Math.sin(2 * Math.PI * profile[1] * t) * 0.22 +
      Math.sin(2 * Math.PI * profile[2] * t * 0.5) * 0.18 +
      wash +
      pulse +
      bell;
    sample *= envelope * (options.gain ?? 0.6);
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * blockAlign, sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function mulberry32(seed) {
  let t = Math.floor(seed * 1e9) || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
