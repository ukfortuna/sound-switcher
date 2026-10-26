import { syncHook } from '../shared/hook.mjs';
export default function main() {
  if (!/(^|\.)steamcommunity\.com$/.test(location.hostname)) return;
  syncHook(window, () => backend.getSoundSettings());
}
