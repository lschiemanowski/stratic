import { createConnection, createServer } from 'node:net';
import { chmodSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { localDirectory, readJson, writeJson } from './git.ts';
import type { Passage } from './model.ts';

export interface Selection { project: string; revision: string; description?: string; passage?: Passage }
export type UIRequest = { action: 'current' } | { action: 'open'; description: string; revision?: string; passage?: Passage };
const responseTimeout = (request: UIRequest) => request?.action === 'open' ? 30_000 : 3000;
export async function serveUI(root: string, handler: (request: UIRequest) => Selection | Promise<Selection>) {
  const socketPath = join(tmpdir(), `stratic-${randomUUID().slice(0, 12)}.sock`), token = randomUUID();
  const infoPath = join(localDirectory(root), 'ui.json');
  const server = createServer(socket => {
    socket.setTimeout(3000, () => socket.destroy());
    let data = '';
    let handled = false;
    socket.on('data', async chunk => {
      if (handled) return;
      data += chunk.toString();
      if (data.length > 65536) { socket.destroy(); return; }
      if (!data.includes('\n')) return;
      handled = true;
      try {
        const message = JSON.parse(data.slice(0, data.indexOf('\n')));
        if (message.token !== token) throw new Error('Invalid UI session.');
        socket.setTimeout(responseTimeout(message.request));
        socket.end(JSON.stringify({ ok: true, value: await handler(message.request) }) + '\n');
      } catch (e) { socket.end(JSON.stringify({ ok: false, error: (e as Error).message }) + '\n'); }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  chmodSync(socketPath, 0o600); writeJson(infoPath, { socketPath, token });
  return () => {
    server.close(); rmSync(socketPath, { force: true });
    if (existsSync(infoPath) && readJson<{ token: string }>(infoPath).token === token) rmSync(infoPath);
  };
}
export async function requestUI(root: string, request: UIRequest): Promise<Selection> {
  const info = readJson<{ socketPath: string; token: string }>(join(localDirectory(root), 'ui.json'));
  return new Promise((resolve, reject) => {
    const socket = createConnection(info.socketPath);
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('Desktop did not respond in time. Check that this project is open in Stratic.')); });
    let data = '';
    socket.on('connect', () => {
      socket.setTimeout(responseTimeout(request));
      socket.write(JSON.stringify({ token: info.token, request }) + '\n');
    });
    socket.on('error', reject);
    let handled = false;
    socket.on('data', async chunk => {
      if (handled) return; data += chunk.toString(); if (data.length > 65536) { socket.destroy(); reject(new Error('UI response too large.')); } });
    socket.on('end', () => {
      try { const response = JSON.parse(data); if (!response.ok) throw new Error(response.error); resolve(response.value); }
      catch (e) { reject(e); }
    });
  });
}
