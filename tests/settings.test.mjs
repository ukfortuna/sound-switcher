import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSettings, checkSaveResponse} from '../shared/settings.mjs';
const settings = {enabled: false, name: '', wav: ''};
test('reads JSON strings and already parsed settings', () => {
  assert.equal(parseSettings(JSON.stringify(settings)).enabled, false);
  assert.equal(parseSettings(settings).volume, 0.8);
});
test('reads nested transport envelopes without parsing object coercions', () => {
  for (const key of ['result', 'data', 'value', 'returnValue', 'return_value', 'payload', 'return', 'values']) {
    assert.equal(parseSettings({success: true, [key]: [JSON.stringify(settings)]}).enabled, false);
  }
});
test('unknown envelopes report keys; errors and invalid audio are rejected', () => {
  assert.throws(() => parseSettings({unexpected: true}), /unexpected/);
  assert.throws(() => parseSettings({success: false, result: settings}), /başarısız/);
  assert.throws(() => parseSettings({...settings, volume: -1}), /düzeyi/);
  assert.throws(() => parseSettings({...settings, wav: 'https://example.com/test'}), /WAV/);
});
test('save must be explicitly acknowledged', () => {
  checkSaveResponse(true);
  checkSaveResponse({success: true, result: true});
  assert.throws(() => checkSaveResponse(false));
  assert.throws(() => checkSaveResponse({success: false, result: true}));
});
