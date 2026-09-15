import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Launch the installed desktop; keep its lifetime and exit status attached to the terminal. */
export async function openDesktop(project?: string): Promise<number> {
  const directory = fileURLToPath(new URL('../', import.meta.url));
  if (!existsSync(new URL('../dist/main.cjs', import.meta.url))) throw new Error('Desktop build is missing. From a checkout, run npm run build; for an installed package, reinstall Stratic.');
  let executable: string;
  try { executable = (await import('electron')).default as unknown as string; }
  catch { throw new Error('Electron is unavailable. Reinstall Stratic with npm install scripts enabled so Electron can download its runtime.'); }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [directory, ...(project ? ['--project', project] : [])], { stdio: 'inherit', env });
  return await new Promise<number>((resolve, reject) => {
    const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => { cleanup(); resolve(code ?? (signal ? 1 : 0)); });
  });
}
