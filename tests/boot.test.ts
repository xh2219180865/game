import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const boot = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];

async function runBoot(specifier: string, message: { textContent: string } | null): Promise<void> {
  assert.ok(boot, 'The startup entry must observe module loading and evaluation failures');
  const source = boot.replace("'./game.js'", JSON.stringify(specifier));
  // Execute the actual HTML loader with native import; only the module URL and DOM are fixtures.
  await new Function('document', `return ${source.trim()}`)({ querySelector: () => message });
}

test('U03: missing game module replaces loading text and retains the reload action', async () => {
  const message = { textContent: '正在载入谋定山河…' };
  await runBoot(new URL('./missing-game-module.js', import.meta.url).href, message);
  assert.equal(message.textContent, '游戏启动失败，请检查本地服务或浏览器支持后重新载入。');
  assert.match(html, /<button onclick="location\.reload\(\)"[^>]*>重新载入<\/button>/);
});

test('U03: module initialization failure replaces loading text without exposing exception details', async () => {
  const message = { textContent: '正在载入谋定山河…' };
  await runBoot('data:text/javascript,throw new Error("Canvas unavailable")', message);
  assert.equal(message.textContent, '游戏启动失败，请检查本地服务或浏览器支持后重新载入。');
  assert.doesNotMatch(message.textContent, /Canvas unavailable/);
});

test('U03: successful initialization never displays a failure and a removed boot node is safe', async () => {
  const message = { textContent: '正在载入谋定山河…' };
  await runBoot('data:text/javascript,export const ready = true', message);
  assert.equal(message.textContent, '正在载入谋定山河…');
  await runBoot('data:text/javascript,throw new Error("Already removed")', null);
});
