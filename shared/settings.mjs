export const DEFAULT_SETTINGS = Object.freeze({enabled: false, name: '', source: '', wav: '', volume: 0.8});

// RPC transports may supply parsed values or an envelope instead of a JSON string.
export function unwrapRpc(raw, depth = 0) {
  if (depth > 8) throw new Error('Ayar yanıtı çok fazla iç içe geçmiş.');
  if (typeof raw === 'string') {
    try { return unwrapRpc(JSON.parse(raw), depth + 1); }
    catch (error) { if (error instanceof SyntaxError) throw new Error('Ayar yanıtı geçerli JSON değil.'); throw error; }
  }
  if (Array.isArray(raw)) {
    if (raw.length === 1) return unwrapRpc(raw[0], depth + 1);
    throw new Error('Beklenmeyen yanıt listesi.');
  }
  if (raw && typeof raw === 'object') {
    if (raw.success === false || raw.ok === false || raw.error) throw new Error('Millennium ayar çağrısı başarısız.');
    if (typeof raw.enabled === 'boolean') return raw;
    for (const key of ['result', 'data', 'value', 'returnValue', 'return_value', 'payload', 'return', 'values']) {
      if (Object.hasOwn(raw, key)) return unwrapRpc(raw[key], depth + 1);
    }
    throw new Error('Bilinmeyen Millennium yanıt biçimi. Alanlar: ' + Object.keys(raw).join(', '));
  }
  return raw;
}

export function parseSettings(raw) {
  const value = unwrapRpc(raw);
  if (!value || typeof value !== 'object' || typeof value.enabled !== 'boolean') throw new Error('Ayar yanıtı beklenen alanları içermiyor.');
  const next = {...DEFAULT_SETTINGS};
  next.enabled = value.enabled;
  for (const key of ['name', 'source', 'wav']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error('Geçersiz ayar: ' + key);
    if (typeof value[key] === 'string') next[key] = value[key];
  }
  if (next.name.length > 300) throw new Error('Dosya adı çok uzun.');
  for (const key of ['source', 'wav']) {
    if (next[key].length > 3000000 || (next[key] && !/^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(next[key]))) throw new Error('Geçersiz WAV verisi.');
  }
  if (value.volume !== undefined) {
    if (!Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) throw new Error('Geçersiz ses düzeyi.');
    next.volume = value.volume;
  }
  if (next.enabled && !next.wav) throw new Error('Etkin ses için dosya eksik.');
  return next;
}

export function checkSaveResponse(raw) {
  if (unwrapRpc(raw) !== true) throw new Error('Millennium kaydetme işlemini onaylamadı.');
}
