import { parseSettings } from './settings.mjs';
const SLOT = Symbol.for('sound-switcher.v1');
const TARGETS = new Set(['steam_new_chat_message', 'ui_steam_message_old_smooth']);
export function isMessageSound(value, base = 'https://steamcommunity.com/') {
  try {
    const url = new URL(String(value), base);
    if (!['https:', 'http:', 'file:', 'steam:'].includes(url.protocol)) return false;
    const name = decodeURIComponent(url.pathname.split('/').pop() || '').toLowerCase();
    return /\.(m4a|mp3|wav|ogg)$/.test(name) && TARGETS.has(name.replace(/\.[^.]+$/, ''));
  } catch { return false; }
}
export function installHook(realm) {
  if (realm[SLOT]) return realm[SLOT];
  let settings = {enabled: false, wav: ''};
  let expires = 0;
  const status = {media: 0, fetch: 0, xhr: 0, lastError: ''};
  const proto = realm.HTMLMediaElement?.prototype;
  const originalPlay = proto?.play;
  const originalFetch = realm.fetch;
  const xhrProto = realm.XMLHttpRequest?.prototype;
  const originalOpen = xhrProto?.open;
  const responseDescriptor = xhrProto && Object.getOwnPropertyDescriptor(xhrProto, 'response');
  const requests = new WeakMap();
  const replacements = new WeakMap();
  const active = new Set();
  const enabled = () => settings.enabled && settings.wav && Date.now() < expires;
  const matches = value => isMessageSound(value, realm.location?.href);
  const play = function (...args) {
    const source = this.currentSrc || this.src || this.querySelector?.('source')?.src;
    if (!enabled() || !matches(source)) return originalPlay.apply(this, args);
    const custom = new realm.Audio(settings.wav);
    custom.volume = this.volume;
    custom.muted = this.muted;
    active.add(custom);
    custom.addEventListener('ended', () => active.delete(custom), {once: true});
    return Promise.resolve().then(() => originalPlay.call(custom)).then(() => {
      status.media++;
    }).catch(error => {
      active.delete(custom);
      status.lastError = String(error);
      return originalPlay.apply(this, args);
    });
  };
  const fetch = async function (input, init) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (enabled() && method === 'GET' && matches(url)) {
      try {
        const response = await originalFetch.call(realm, settings.wav);
        if (!response.ok) throw new Error('Replacement audio unavailable');
        status.fetch++;
        return response;
      } catch (error) { status.lastError = String(error); }
    }
    return originalFetch.call(realm, input, init);
  };
  // Steam's AudioPlaybackManager uses axios/XHR arraybuffer + decodeAudioData.
  // Replace only the response bytes, preserving the original request lifecycle.
  const open = function (method, url, ...rest) {
    requests.set(this, {method: String(method).toUpperCase(), url: String(url)});
    replacements.delete(this);
    return originalOpen.call(this, method, url, ...rest);
  };
  const response = function () {
    const original = responseDescriptor.get.call(this);
    const request = requests.get(this);
    if (!enabled() || !request || request.method !== 'GET' || !matches(request.url) ||
        this.readyState !== 4 || this.status < 200 || this.status >= 300 ||
        this.responseType !== 'arraybuffer') return original;
    const cached = replacements.get(this);
    if (cached?.wav === settings.wav) return cached.buffer;
    try {
      const binary = (realm.atob || globalThis.atob)(settings.wav.split(',')[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      replacements.set(this, {wav: settings.wav, buffer: bytes.buffer});
      status.xhr++;
      return bytes.buffer;
    } catch (error) { status.lastError = String(error); return original; }
  };
  if (xhrProto && originalOpen && responseDescriptor?.get && responseDescriptor.configurable) {
    xhrProto.open = open;
    Object.defineProperty(xhrProto, 'response', {...responseDescriptor, get: response});
  }
  if (proto && originalPlay) proto.play = play;
  if (originalFetch) realm.fetch = fetch;
  const api = {
    status,
    update(next) {
      if (!next || typeof next.enabled !== 'boolean' || typeof next.wav !== 'string') return;
      if (next.wav && !/^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(next.wav)) return;
      if (next.wav.length > 3000000) return;
      settings = next;
      expires = Date.now() + 12000;
      if (!enabled()) { for (const audio of active) audio.pause(); active.clear(); }
    },
    dispose() {
      settings = {enabled: false, wav: ''};
      for (const audio of active) audio.pause();
      active.clear();
      if (proto?.play === play) proto.play = originalPlay;
      if (realm.fetch === fetch) realm.fetch = originalFetch;
      if (xhrProto?.open === open) xhrProto.open = originalOpen;
      if (xhrProto && Object.getOwnPropertyDescriptor(xhrProto, 'response')?.get === response)
        Object.defineProperty(xhrProto, 'response', responseDescriptor);
      delete realm[SLOT];
    }
  };
  realm[SLOT] = api;
  return api;
}
export function syncHook(realm, readSettings) {
  const hook = installHook(realm);
  let stopped = false;
  let timer;
  const refresh = async () => {
    try {
      const next = parseSettings(await readSettings());
      if (!stopped) { hook.update(next); hook.status.lastError = ''; }
    } catch (error) { hook.status.lastError = String(error); }
    if (!stopped) timer = realm.setTimeout(refresh, 2000);
  };
  void refresh();
  const stop = () => { stopped = true; realm.clearTimeout(timer); hook.dispose(); };
  realm.addEventListener('pagehide', stop, {once: true});
  return hook;
}

