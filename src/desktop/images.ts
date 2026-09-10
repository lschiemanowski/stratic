import { posix } from 'node:path';
import { readBinarySource } from '../git.ts';
import { getDescription } from '../project.ts';
import type { Project } from '../model.ts';

export function imagePath(descriptionPath: string, url: string): string {
  if (!url || /[\\\0]/.test(url) || /^[a-z][\w+.-]*:/i.test(url) || url.startsWith('//')) throw new Error('Use an image stored in this project.');
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  if (/[\\\0]/.test(path) || path.startsWith('//') || /^[a-z][\w+.-]*:/i.test(path)) throw new Error('Invalid image path.');
  const resolved = posix.normalize(path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(descriptionPath), path));
  if (resolved === '..' || resolved.startsWith('../')) throw new Error('Image path leaves the project.');
  return resolved;
}
export function projectImage(project: Project, description: string, url: string, revision = project.revision): string {
  const d = getDescription(project, description), path = imagePath(d.path, url);
  const bytes = readBinarySource(project.root, path, revision);
  let mime: string;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) mime = 'image/gif';
  else if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') mime = 'image/webp';
  else if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(bytes.toString('utf8'))) mime = 'image/svg+xml';
  else throw new Error('Unsupported image format.');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
