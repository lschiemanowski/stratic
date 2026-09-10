import type { Description, Project } from '../model.ts';

const width = 220, height = 52, indent = 28, row = 66;
export function treeLayout(descriptions: Description[], depthLimit = Infinity, folded: ReadonlySet<string> = new Set()) {
  const indices = new Map<string, number[]>();
  descriptions.forEach((d, i) => indices.set(d.id, [...(indices.get(d.id) ?? []), i]));
  const parents = descriptions.map((d, i) => {
    const seen = new Set([i]); let cursor = d, parent: number | undefined;
    if (indices.get(d.id)!.length !== 1) return undefined;
    while (cursor.metadata?.parent) {
      const matches = indices.get(cursor.metadata.parent.description);
      if (matches?.length !== 1 || seen.has(matches[0])) return undefined;
      parent ??= matches[0]; seen.add(matches[0]); cursor = descriptions[matches[0]];
    }
    return parent;
  });
  const children = descriptions.map(() => [] as number[]), roots: number[] = [];
  parents.forEach((parent, i) => parent === undefined ? roots.push(i) : children[parent].push(i));
  const all = descriptions.map((description, i) => ({ description, parent: parents[i], depth: 1, x: 0, y: 32, hasChildren: children[i].length > 0, expanded: false }));
  const visible = new Set<number>(); let maxDepth = 1;
  const stack = roots.map(i => ({ i, depth: 1, shown: true }));
  while (stack.length) {
    const { i, depth, shown } = stack.pop()!, n = all[i]; n.depth = depth; maxDepth = Math.max(maxDepth, depth);
    if (shown) visible.add(i);
    n.expanded = n.hasChildren && depth < depthLimit && !folded.has(n.description.path);
    for (const child of children[i]) stack.push({ i: child, depth: depth + 1, shown: shown && n.expanded });
  }
  let left = 32;
  for (const root of roots) {
    const branches = children[root].filter(i => visible.has(i));
    const start = left;
    for (const branch of branches) {
      let y = 136, extent = width;
      const pending = [branch];
      while (pending.length) {
        const i = pending.pop()!, n = all[i];
        n.x = left + (n.depth - 2) * indent; n.y = y; y += row;
        extent = Math.max(extent, n.x - left + width);
        for (const child of children[i].slice().reverse()) if (visible.has(child)) pending.push(child);
      }
      left += extent + 32;
    }
    if (!branches.length) left += width + 32;
    all[root].x = (start + left - 32 - width) / 2;
    left += 32;
  }
  const remap = new Map([...visible].sort((a, b) => a - b).map((i, j) => [i, j]));
  const nodes = [...remap.keys()].map(i => ({ ...all[i], parent: all[i].parent === undefined ? undefined : remap.get(all[i].parent!) }));
  return { nodes, maxDepth, width: Math.max(width, ...nodes.map(n => n.x + width)) + 32, height: Math.max(height, ...nodes.map(n => n.y + height)) + 32 };
}

export interface TreeCamera { x: number; y: number; scale: number; initialized: boolean; depth?: number; folded?: Set<string> }
export function treeView(project: Project, active: string | undefined, camera: TreeCamera, open: (id: string) => void, close: () => void) {
  camera.folded ??= new Set();
  let layout = treeLayout(project.descriptions, camera.depth, camera.folded);
  const section = document.createElement('section'); section.className = 'tree-overview'; section.setAttribute('aria-label', 'Tree overview');
  const controls = document.createElement('div'); controls.className = 'tree-tools';
  const control = (label: string, action: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = action; controls.append(b); return b; };
  const viewport = document.createElement('div'); viewport.className = 'tree-viewport'; viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Description hierarchy');
  const canvas = document.createElement('div'); canvas.className = 'tree-canvas';
  viewport.append(canvas); section.append(controls, viewport);
  const paint = () => { canvas.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`; };
  const center = (x: number, y: number) => { camera.x = viewport.clientWidth / 2 - x * camera.scale; camera.y = viewport.clientHeight / 2 - y * camera.scale; paint(); };
  const zoom = (factor: number, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) => {
    const next = Math.max(.01, Math.min(2.5, camera.scale * factor)), ratio = next / camera.scale;
    camera.x = x - (x - camera.x) * ratio; camera.y = y - (y - camera.y) * ratio; camera.scale = next; paint();
  };
  const fit = () => { camera.scale = Math.max(.01, Math.min(1, viewport.clientWidth / layout.width, viewport.clientHeight / layout.height)); center(layout.width / 2, layout.height / 2); };
  const draw = () => {
    layout = treeLayout(project.descriptions, camera.depth, camera.folded);
    canvas.replaceChildren(); canvas.style.width = `${layout.width}px`; canvas.style.height = `${layout.height}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', String(layout.width)); svg.setAttribute('height', String(layout.height)); svg.setAttribute('aria-hidden', 'true'); canvas.append(svg);
    for (const node of layout.nodes) {
      if (node.parent !== undefined) {
        const parent = layout.nodes[node.parent];
        const line = document.createElementNS(svg.namespaceURI, 'path');
        if (node.depth === 2) {
          const x = parent.x + width / 2, y = parent.y + height, endX = node.x + width / 2;
          line.setAttribute('d', `M${x},${y} V${y + 26} H${endX} V${node.y}`);
        } else line.setAttribute('d', `M${parent.x + 14},${parent.y + height} V${node.y + height / 2} H${node.x}`);
        svg.append(line);
      }
      const card = document.createElement('div'); card.className = 'tree-card'; card.style.left = `${node.x}px`; card.style.top = `${node.y}px`;
      const button = document.createElement('button'); button.className = 'tree-node'; button.textContent = node.description.title; button.title = node.description.title;
      button.dataset.description = node.description.id;
      if (node.description.id === active) button.setAttribute('aria-current', 'true');
      button.onclick = () => open(node.description.id);
      button.onfocus = () => { if (button.matches(':focus-visible')) center(node.x + width / 2, node.y + height / 2); };
      card.append(button);
      if (node.hasChildren) {
        card.classList.add('has-children');
        const fold = document.createElement('button'); fold.className = 'tree-fold'; fold.textContent = node.expanded ? '−' : '+';
        fold.setAttribute('aria-label', `${node.expanded ? 'Fold' : 'Expand'} ${node.description.title}`); fold.setAttribute('aria-expanded', String(node.expanded));
        fold.dataset.path = node.description.path;
        fold.onclick = () => {
          if (node.expanded) camera.folded!.add(node.description.path);
          else { camera.folded!.delete(node.description.path); if ((camera.depth ?? Infinity) <= node.depth) camera.depth = node.depth + 1; }
          draw(); syncDepth();
          const moved = layout.nodes.find(n => n.description.path === node.description.path)!;
          camera.x += (node.x - moved.x) * camera.scale; camera.y += (node.y - moved.y) * camera.scale; paint();
          const replacement = Array.from(canvas.querySelectorAll<HTMLButtonElement>('.tree-fold')).find(b => b.dataset.path === node.description.path); replacement?.focus({ preventScroll: true });
        };
        card.append(fold);
      }
      canvas.append(card);
    }
  };
  control('Back to reading', close);
  const depthLabel = document.createElement('label'); depthLabel.className = 'tree-depth';
  const depthText = document.createElement('span'), slider = document.createElement('input'); slider.type = 'range'; slider.min = '1'; slider.step = '1'; slider.setAttribute('aria-label', 'Visible tree levels');
  const syncDepth = () => { const value = Math.min(camera.depth ?? layout.maxDepth, layout.maxDepth); slider.max = String(layout.maxDepth); slider.value = String(value); depthText.textContent = `Levels · ${value === layout.maxDepth ? 'all' : value}`; slider.setAttribute('aria-valuetext', value === layout.maxDepth ? `All ${value} levels` : `${value} levels`); };
  slider.oninput = () => { camera.depth = Number(slider.value) === layout.maxDepth ? undefined : Number(slider.value); draw(); syncDepth(); fit(); };
  depthLabel.append(depthText, slider); controls.append(depthLabel);
  control('−', () => zoom(1 / 1.3)).setAttribute('aria-label', 'Zoom out'); control('+', () => zoom(1.3)).setAttribute('aria-label', 'Zoom in'); control('Fit tree', fit);
  control('Current description', () => {
    const all = treeLayout(project.descriptions); let node = all.nodes.find(n => n.description.id === active);
    if (!node) return;
    if ((camera.depth ?? Infinity) < node.depth) camera.depth = node.depth;
    while (node.parent !== undefined) { node = all.nodes[node.parent]; camera.folded!.delete(node.description.path); }
    draw(); syncDepth(); const selected = layout.nodes.find(n => n.description.id === active)!;
    camera.scale = 1; center(selected.x + width / 2, selected.y + height / 2);
  });
  viewport.onwheel = event => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) { const bounds = viewport.getBoundingClientRect(); zoom(Math.exp(-event.deltaY * .01), event.clientX - bounds.left, event.clientY - bounds.top); }
    else { camera.x -= event.deltaX; camera.y -= event.deltaY; paint(); }
  };
  let drag: { id: number; x: number; y: number } | undefined;
  viewport.onpointerdown = event => { if (event.button !== 0 || (event.target as Element).closest('button')) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; viewport.setPointerCapture(event.pointerId); viewport.classList.add('dragging'); };
  viewport.onpointermove = event => { if (!drag || drag.id !== event.pointerId) return; camera.x += event.clientX - drag.x; camera.y += event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY; paint(); };
  viewport.onpointerup = viewport.onpointercancel = () => { drag = undefined; viewport.classList.remove('dragging'); };
  draw(); syncDepth();
  requestAnimationFrame(() => { if (!section.isConnected) return; if (!camera.initialized) { fit(); camera.initialized = true; } else paint(); });
  return section;
}
