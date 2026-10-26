import test from 'node:test';
import assert from 'node:assert/strict';
import {isMessageSound, installHook} from '../shared/hook.mjs';
import {encodeWav, applyGain, toDataUrl, fromDataUrl} from '../shared/wav.mjs';
const wav = 'data:audio/wav;base64,UklGRg==';
function mock() {
  const played = [], fetched = [];
  class Media {
    constructor(src) {this.src = src; this.volume = 0.6; this.muted = false;}
    play() {played.push(this.src); if (this.src === wav && this.fail) return Promise.reject(new Error('blocked')); return Promise.resolve();}
    pause() {}
    addEventListener() {}
  }
  const realm = {HTMLMediaElement: Media, Audio: Media, location: {href: 'https://steamcommunity.com/chat/'},
    fetch: async (input, init) => {fetched.push([input, init]); return {ok: true, input};}};
  return {realm, played, fetched, Media};
}
test('matches only exact private-message filenames', () => {
  assert.ok(isMessageSound('/public/sounds/webui/steam_new_chat_message.m4a?v=2'));
  assert.ok(isMessageSound('https://cdn.test/ui_steam_message_old_smooth.m4a'));
  for (const value of ['steam_friend_online.m4a', 'steam_chatroom_notification.m4a', 'xsteam_new_chat_message.m4a', 'data:audio/wav;base64,AAAA', 'javascript:steam_new_chat_message.wav', '/steam_new_chat_message.m4a/other']) assert.equal(isMessageSound(value), false);
});
test('disabled passes through; enabled replaces; restore disposes', async () => {
  const {realm, played, Media} = mock();
  const original = Media.prototype.play;
  const h = installHook(realm);
  assert.equal(installHook(realm), h);
  const message = new Media('/steam_new_chat_message.m4a');
  await message.play();
  h.update({enabled: true, wav});
  await message.play();
  await new Media('/steam_friend_online.m4a').play();
  assert.deepEqual(played, ['/steam_new_chat_message.m4a', wav, '/steam_friend_online.m4a']);
  assert.equal(message.src, '/steam_new_chat_message.m4a');
  assert.equal(h.status.media, 1);
  h.update({enabled: false, wav: ''});
  await message.play();
  assert.equal(played.at(-1), message.src);
  h.dispose(); assert.equal(Media.prototype.play, original);
});
test('replacement failure plays original instead', async () => {
  const {realm, played, Media} = mock();
  realm.Audio = class extends Media {constructor(src) {super(src); this.fail = true;}};
  const h = installHook(realm); h.update({enabled: true, wav});
  await new Media('/steam_new_chat_message.m4a').play();
  assert.deepEqual(played, [wav, '/steam_new_chat_message.m4a']);
  assert.match(h.status.lastError, /blocked/);
});
test('fetch intercepts audio GET only, preserves unrelated requests', async () => {
  const {realm, fetched} = mock();
  const h = installHook(realm); h.update({enabled: true, wav});
  await realm.fetch('/ui_steam_message_old_smooth.m4a');
  const options = {method: 'POST', body: 'test'};
  await realm.fetch('/ui_steam_message_old_smooth.m4a', options);
  await realm.fetch('/steam_friend_online.m4a');
  assert.deepEqual(fetched, [[wav, undefined], ['/ui_steam_message_old_smooth.m4a', options], ['/steam_friend_online.m4a', undefined]]);
});
test('fetch failures fall back and invalid data is ignored', async () => {
  const {realm, fetched} = mock();
  const native = realm.fetch;
  realm.fetch = async (url, init) => {if (url === wav) throw new Error('CSP blocked'); return native(url, init);};
  const h = installHook(realm);
  h.update({enabled: true, wav: 'https://untrusted.test/audio'});
  await realm.fetch('/steam_new_chat_message.m4a');
  h.update({enabled: true, wav});
  await realm.fetch('/steam_new_chat_message.m4a');
  assert.equal(fetched.length, 2);
  assert.match(h.status.lastError, /CSP/);
});
test('PCM16 header, stereo interleave, clipping, gain, base64 roundtrip', () => {
  const bytes = encodeWav([new Float32Array([-2, 0.5]), new Float32Array([2, -0.5])], 44100);
  const v = new DataView(bytes.buffer);
  assert.equal(bytes.length, 52); assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint16(34, true), 16); assert.equal(v.getUint32(24, true), 44100);
  assert.deepEqual([44, 46, 48, 50].map(p => v.getInt16(p, true)), [-32768, 32767, 16384, -16384]);
  const quiet = applyGain(bytes, 0.5);
  assert.equal(new DataView(quiet.buffer).getInt16(44, true), -16384);
  assert.equal(v.getInt16(44, true), -32768);
  assert.deepEqual(fromDataUrl(toDataUrl(bytes)), bytes);
  assert.throws(() => applyGain(bytes, 2));
});
function xhrMock() {
  const env = mock();
  class XHR {
    constructor() {this.readyState = 0; this.status = 0; this.responseType = ''; this.native = new Uint8Array([9, 9]).buffer;}
    open(method, url, ...rest) {this.openArgs = [method, url, ...rest]; this.readyState = 1;}
    get response() {return this.readyState === 4 ? this.native : null;}
  }
  env.realm.XMLHttpRequest = XHR;
  env.realm.atob = atob;
  return {...env, XHR};
}
test('Steam axios/XHR arraybuffer flow receives replacement bytes once', () => {
  const {realm, XHR} = xhrMock();
  const h = installHook(realm); h.update({enabled: true, wav});
  const xhr = new XHR(); xhr.open('GET', 'https://cdn.test/public/sounds/webui/ui_steam_message_old_smooth.m4a', true);
  xhr.responseType = 'arraybuffer';
  assert.equal(xhr.response, null);
  xhr.readyState = 4; xhr.status = 200;
  assert.deepEqual([...new Uint8Array(xhr.response)], [82, 73, 70, 70]);
  assert.equal(xhr.response, xhr.response);
  assert.equal(h.status.xhr, 1);
  assert.equal(xhr.openArgs[1], 'https://cdn.test/public/sounds/webui/ui_steam_message_old_smooth.m4a');
  h.update({enabled: false, wav: ''});
  assert.equal(xhr.response, xhr.native);
});
test('XHR ignores unrelated sounds, errors, non-GET and non-buffer requests', () => {
  const {realm, XHR} = xhrMock();
  const h = installHook(realm); h.update({enabled: true, wav});
  for (const [method, url, status, type] of [
    ['GET', '/steam_friend_online.m4a', 200, 'arraybuffer'],
    ['POST', '/ui_steam_message_old_smooth.m4a', 200, 'arraybuffer'],
    ['GET', '/ui_steam_message_old_smooth.m4a', 404, 'arraybuffer'],
    ['GET', '/ui_steam_message_old_smooth.m4a', 200, 'text']
  ]) {
    const xhr = new XHR(); xhr.open(method, url); xhr.readyState = 4; xhr.status = status; xhr.responseType = type;
    assert.equal(xhr.response, xhr.native);
  }
  assert.equal(h.status.xhr, 0);
});
test('XHR re-use clears prior replacement and dispose restores descriptors', () => {
  const {realm, XHR} = xhrMock();
  const getter = Object.getOwnPropertyDescriptor(XHR.prototype, 'response').get;
  const open = XHR.prototype.open;
  const h = installHook(realm); h.update({enabled: true, wav});
  const xhr = new XHR(); xhr.open('GET', '/ui_steam_message_old_smooth.m4a'); xhr.readyState = 4; xhr.status = 200; xhr.responseType = 'arraybuffer';
  assert.notEqual(xhr.response, xhr.native);
  xhr.open('GET', '/other.m4a'); xhr.readyState = 4;
  assert.equal(xhr.response, xhr.native);
  h.dispose();
  assert.equal(XHR.prototype.open, open);
  assert.equal(Object.getOwnPropertyDescriptor(XHR.prototype, 'response').get, getter);
});
