import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('stratic', {
  copyId: () => ipcRenderer.invoke('copy-id'),
  view: () => ipcRenderer.invoke('view'),
  navigate: (request: unknown) => ipcRenderer.invoke('navigate', request),
  source: (path: string) => ipcRenderer.invoke('source', path),
  chooseProject: () => ipcRenderer.invoke('choose-project'),
  onSelection: (callback: () => void) => { ipcRenderer.on('selection', callback); },
});
