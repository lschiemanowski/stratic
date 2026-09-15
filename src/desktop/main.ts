import { projectImage } from './images.ts';
import { viewData, stopViewWorker } from './view-cache.ts';
import { app, BrowserWindow, clipboard, dialog, ipcMain, session } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { repository, readSource, git } from '../git.ts';
import { getDescription, targetContent } from '../project.ts';
import { isPassage } from '../passages.ts';
import { serveUI } from '../ui-channel.ts';
import type { Selection, UIRequest } from '../ui-channel.ts';

const projectArgument = process.argv.indexOf('--project');
let root = projectArgument < 0 ? '' : repository(process.argv[projectArgument + 1]);
let selection: Selection = { project: root, revision: 'working' };
let window: BrowserWindow;
let stopUI: (() => void) | undefined;
let projects: string[] = [];
async function navigate(request: UIRequest): Promise<Selection> {
  if (!request || !['current', 'open'].includes(request.action)) throw new Error('Use current or open.');
  if (request.action === 'current') return selection;
  if (typeof request.description !== 'string' || (request.revision !== undefined && typeof request.revision !== 'string') ||
      (request.passage !== undefined && !isPassage(request.passage))) throw new Error('Invalid description selection.');
  const requested = request.revision ?? selection.revision;
  const pinned = requested === 'working' ? requested : git(root, ['rev-parse', '--verify', '--end-of-options', `${requested}^{commit}`]).trim();
  let { project } = await viewData(root, pinned);
  if (!project.descriptions.some(d => d.id === request.description)) ({ project } = await viewData(root, pinned, true));
  getDescription(project, request.description);
  if (request.passage) targetContent(project, { description: request.description, passage: request.passage });
  selection = { project: root, revision: pinned, description: request.description, ...(request.passage ? { passage: request.passage } : {}) };
  window.webContents.send('selection', selection);
  return selection;
}
async function attach(path: string) {
  const next = repository(path);
  const { project } = await viewData(next, 'working', true);
  if (!project.config && !project.descriptions.length) throw new Error('This folder has no readable Stratic project.');
  const nextUI = next === root && stopUI ? stopUI : await serveUI(next, navigate);
  if (nextUI !== stopUI) stopUI?.();
  root = next; stopUI = nextUI;
  selection = { project: root, revision: 'working', description: project.descriptions.find(d => d.metadata?.parent === null)?.id ?? project.descriptions[0]?.id };
  projects = [root, ...projects.filter(path => path !== root)].slice(0, 12);
  try { writeFileSync(join(app.getPath('userData'), 'projects.json'), JSON.stringify(projects)); }
  catch (error) { console.error('Could not save recent projects:', error); }
}
async function view() {
  if (!root) return { tree: '', selection, projects, project: null, checks: [], ready: null, history: [], dirty: false, comparison: null };
  const at = selection;
  const data = await viewData(root, at.revision);
  if (selection !== at) return view();
  return { ...data, selection: at, projects };
}
app.setName('Stratic v3');
if (process.env.STRATIC_USER_DATA) app.setPath('userData', process.env.STRATIC_USER_DATA);
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopUI?.(); stopViewWorker(); });
async function start() {
await app.whenReady();
const icon = join(__dirname, 'stratic-icon.png');
app.dock?.setIcon(icon);
try {
  const saved: unknown = JSON.parse(readFileSync(join(app.getPath('userData'), 'projects.json'), 'utf8'));
  if (Array.isArray(saved)) projects = [...new Set(saved.filter((path): path is string => typeof path === 'string'))].slice(0, 12);
} catch { /* A missing or damaged recent list does not prevent opening a project. */ }
session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
window = new BrowserWindow({ width: 1280, height: 850, minWidth: 800, minHeight: 550, title: 'Stratic v3', icon, backgroundColor: '#f5f4ef',
  titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 17 },
  ...(process.platform !== 'darwin' ? { titleBarOverlay: { color: '#f5f4ef', symbolColor: '#25332f', height: 48 } } : {}),
  webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', e => e.preventDefault());
const entryURL = pathToFileURL(join(__dirname, 'index.html')).href;
function verify(event: Electron.IpcMainInvokeEvent) {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame?.url !== entryURL) throw new Error('Unrecognized desktop caller.');
}
ipcMain.handle('view', event => { verify(event); return view(); });
ipcMain.handle('navigate', (event, request) => { verify(event); return navigate(request); });
ipcMain.handle('copy-id', event => { verify(event); if (!selection.description) throw new Error('Select a description first.'); clipboard.writeText(selection.description); });
ipcMain.handle('source', (event, path) => { verify(event); if (typeof path !== 'string') throw new Error('Expected a source path.'); return readSource(root, path, selection.revision); });
ipcMain.handle('image', async (event, request) => {
  verify(event);
  if (!request || typeof request.description !== 'string' || typeof request.url !== 'string' || request.project !== root) throw new Error('Image request does not match the displayed project.');
  const at = selection, data = await viewData(root, at.revision);
  if (selection !== at || request.revision !== data.project.revision || request.tree !== data.tree) throw new Error('The displayed content changed; retry after refresh.');
  return projectImage(data.project, request.description, request.url, data.tree);
});
ipcMain.handle('choose-project', async (event, path?: unknown) => {
  verify(event);
  if (path !== undefined) {
    if (typeof path !== 'string' || !projects.includes(path)) throw new Error('Choose a recent project or use the folder picker.');
    await attach(path);
  } else {
    const choice = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    if (!choice.canceled) await attach(choice.filePaths[0]);
  }
  return view();
});
if (root) await attach(root);
await window.loadFile(join(__dirname, 'index.html'));

}
start().catch(error => { console.error(error); app.quit(); });
