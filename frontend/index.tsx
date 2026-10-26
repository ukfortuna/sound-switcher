import { definePlugin } from 'millennium';
import { parseSettings, checkSaveResponse } from '../shared/settings.mjs';
import { useEffect, useRef, useState } from 'react';
import { syncHook } from '../shared/hook.mjs';
import { applyGain, encodeWav, fromDataUrl, toDataUrl } from '../shared/wav.mjs';

type Settings = {enabled: boolean; name: string; source: string; wav: string; volume: number};
const defaults: Settings = {enabled: false, name: '', source: '', wav: '', volume: 0.8};
let runtime: ReturnType<typeof syncHook>;
const style = {display: 'grid', gap: '14px', padding: '16px', color: '#dbe2eb', maxWidth: '640px'};

function SettingsMenu() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Ayarlar yükleniyor…');
  const [stats, setStats] = useState('');
  const preview = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    let mounted = true;
    backend.getSoundSettings().then(raw => {
      if (mounted) { setSettings(parseSettings(raw)); setReady(true); setMessage(''); }
    }).catch(error => { if (mounted) setMessage(String(error)); });
    const timer = setInterval(() => {
      const s = runtime?.status;
      if (mounted && s) setStats(`Bu pencere: ${s.media} oynatma, ${s.fetch} fetch, ${s.xhr} XHR ses isteği. ${s.lastError || ''}`);
    }, 2000);
    return () => { mounted = false; clearInterval(timer); preview.current?.pause(); };
  }, []);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    let context: AudioContext | undefined;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Dosya en fazla 5 MB olmalı.');
      context = new AudioContext({sampleRate: 44100});
      const audio = await context.decodeAudioData(await file.arrayBuffer());
      if (audio.duration > 10) throw new Error('Bildirim sesi en fazla 10 saniye olmalı.');
      const channels = Array.from({length: Math.min(2, audio.numberOfChannels)}, (_, i) => audio.getChannelData(i));
      const bytes = encodeWav(channels, audio.sampleRate);
      const source = toDataUrl(bytes);
      if (source.length > 2500000) throw new Error('Dönüştürülen ses çok büyük.');
      setSettings(s => ({...s, name: file.name.slice(0, 100), source, enabled: true, wav: ''}));
      setDirty(true);
      setMessage('Ses seçildi ama henüz kaydedilmedi. Kaydet düğmesine bas.');
    } catch (error) { setMessage(String(error)); }
    finally { await context?.close(); setBusy(false); }
  }
  function rendered() {
    return settings.source ? toDataUrl(applyGain(fromDataUrl(settings.source), settings.volume)) : '';
  }
  async function listen() {
    try {
      preview.current?.pause();
      preview.current = new Audio(rendered());
      await preview.current.play();
      setMessage('Önizleme çalıyor. Gerçek mesaj testi ayrıca gerekli.');
    } catch (error) { setMessage(`Önizleme başarısız: ${error}`); }
  }
  async function save(reset = false) {
    setBusy(true);
    try {
      const next = reset ? {...defaults} : {...settings, wav: rendered()};
      checkSaveResponse(await backend.saveSoundSettings(JSON.stringify(next)));
      const stored = parseSettings(await backend.getSoundSettings());
      if (stored.enabled !== next.enabled || stored.name !== next.name || stored.source !== next.source || stored.wav !== next.wav || stored.volume !== next.volume)
        throw new Error('Kaydedilen ayarlar geri okunduğunda eşleşmedi.');
      runtime?.update(stored);
      setSettings(next);
      setDirty(false);
      setMessage(reset ? 'Varsayılan Steam sesi geri yüklendi.' : 'Kaydedildi ve geri okunarak doğrulandı. Menüden çıkıp geri gelerek seçimi kontrol edebilirsin.');
    } catch (error) { setMessage(`Kaydedilemedi: ${error}`); }
    finally { setBusy(false); }
  }
  return <section style={style}>
    <h2 style={{margin: 0}}>Sound Switcher</h2>
    <p style={{margin: 0}}>Özel mesaj bildirimi · Deneysel 0.1.5</p>
    <label><input type="checkbox" checked={settings.enabled} disabled={!ready || busy} onChange={e => { setDirty(true); setSettings(s => ({...s, enabled: e.target.checked})); }} /> Özel mesaj sesini kullan</label>
    <label>Ses dosyası (WAV, MP3, OGG veya M4A; en fazla 10 saniye)
      <input style={{display: 'block', marginTop: '8px'}} type="file" accept=".wav,.mp3,.ogg,.m4a,audio/*" disabled={!ready || busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    <span>Seçilen: {settings.name || 'Steam varsayılanı'}</span>
    <label>Ses düzeyi: %{Math.round(settings.volume * 100)}
      <input style={{display: 'block', width: '100%'}} type="range" min="0" max="100" value={Math.round(settings.volume * 100)} disabled={!ready || busy} onChange={e => { setDirty(true); setSettings(s => ({...s, volume: Number(e.target.value) / 100})); }} />
    </label>
    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
      <button disabled={!ready || busy || !settings.source} onClick={() => void listen()}>Önizle</button>
      <button disabled={!ready || busy || (settings.enabled && !settings.source)} onClick={() => void save()}>Kaydet</button>
      <button disabled={!ready || busy} onClick={() => void save(true)}>Varsayılana dön</button>
    </div>
    <p role="status">{dirty && <strong>Kaydedilmemiş değişiklik var. </strong>}{message}</p>
    <small>{stats}</small>
    <small>Önizlemenin çalışması, Steam mesajının yakalandığını kanıtlamaz. Kaydettikten sonra başka bir hesaptan gerçek mesaj göndererek dene. Yeniden başlatma, önbellekteki eski sesi temizlemek için gerekebilir.</small>
  </section>;
}
export default definePlugin(() => {
  runtime = syncHook(window, () => backend.getSoundSettings());
  return {title: 'Sound Switcher', icon: <span aria-hidden="true">♫</span>, content: <SettingsMenu />};
});


