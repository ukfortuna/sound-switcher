export function encodeWav(channels, rate) {
  if (!channels.length || channels.length > 2 || !channels[0].length) throw new Error('Invalid channels');
  const frames = channels[0].length;
  const count = channels.length;
  const buffer = new ArrayBuffer(44 + frames * count * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, count, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * count * 2, true); view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
  for (let i = 0; i < frames; i++) for (let c = 0; c < count; c++) {
    const sample = Math.max(-1, Math.min(1, channels[c][i]));
    view.setInt16(44 + (i * count + c) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Uint8Array(buffer);
}
export function applyGain(bytes, volume) {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid volume');
  const copy = bytes.slice();
  const v = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (copy.length < 44 || v.getUint16(20, true) !== 1 || v.getUint16(34, true) !== 16) throw new Error('Expected PCM16 WAV');
  for (let p = 44; p + 1 < copy.length; p += 2) v.setInt16(p, Math.round(v.getInt16(p, true) * volume), true);
  return copy;
}
export function toDataUrl(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return 'data:audio/wav;base64,' + btoa(binary);
}
export function fromDataUrl(url) {
  return Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
}
