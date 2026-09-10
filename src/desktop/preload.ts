import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('stratic', {
  copyId: () => ipcRenderer.invoke('copy-id'),
  view: () => ipcRenderer.invoke('view'),
  navigate: (request: unknown) => ipcRenderer.invoke('navigate', request),
  image: (request: unknown) => ipcRenderer.invoke('image', request),
  source: (path: string) => ipcRenderer.invoke('source', path),
  chooseProject: (path?: string) => ipcRenderer.invoke('choose-project', path),
  onSelection: (callback: () => void) => { ipcRenderer.on('selection', callback); },
});
