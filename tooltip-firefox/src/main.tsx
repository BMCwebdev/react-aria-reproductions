import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Dialog, DialogTrigger, Popover, Tooltip, TooltipTrigger } from 'react-aria-components';
import manifest from '../package.json';
import './style.css';

const params = new URLSearchParams(location.search);
const synthetic = params.get('mode') === 'synthetic';
const guard = params.get('guard') === '1';
const animate = params.get('animate') === '1';
const load = params.get('load') === '1';
const dialog = params.get('composition') === 'dialog';
const sweep = params.get('sequence') === 'sweep';
const frames: unknown[] = [];
const changes: unknown[] = [];
let capture = false;
let frame = 0;
let pressure: ReturnType<typeof setInterval> | undefined;
const rect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });

function sample() {
  for (const tip of document.querySelectorAll<HTMLElement>('[role="tooltip"]')) {
    const box = tip.getBoundingClientRect();
    const style = getComputedStyle(tip);
    const trigger = document.querySelector(`[data-trigger="${tip.dataset.for}"]`);
    frames.push({
      time: performance.now(), text: tip.textContent, ...rect(box),
      placement: tip.getAttribute('data-placement'),
      exiting: tip.hasAttribute('data-exiting'), entering: tip.hasAttribute('data-entering'),
      visibility: style.visibility, opacity: style.opacity,
      visible: box.width > 0 && box.height > 0 && style.visibility === 'visible' && Number(style.opacity) > 0,
      trigger: trigger ? rect(trigger.getBoundingClientRect()) : null,
    });
  }
  if (capture) frame = requestAnimationFrame(sample);
}
const probe = {
  start() {
    if (capture) return;
    frames.length = 0; changes.length = 0; capture = true;
    sample();
    if (load) pressure = setInterval(() => {
      const end = performance.now() + 35;
      while (performance.now() < end) { /* Explicit optional main-thread stress. */ }
    }, 45);
  },
  stop() {
    capture = false; cancelAnimationFrame(frame); clearInterval(pressure);
    return { config: { synthetic, guard, animate, load, sweep, dialog }, frames: [...frames], changes: [...changes] };
  },
  snapshot() { return { frames: [...frames], changes: [...changes] }; },
};
Object.assign(window, { tooltipProbe: probe });

function Example({ name }: { name: string }) {
  return <TooltipTrigger delay={400} {...(synthetic ? { isOpen: false } : {})}
    onOpenChange={isOpen => { if (capture) changes.push({ time: performance.now(), name, isOpen }); }}>
    <Button data-trigger={name}>{name}</Button>
    <Tooltip data-for={name} offset={8} containerPadding={8}
      {...(synthetic ? { isExiting: true } : {})}
      className={({ placement }) => ['tooltip', guard && !placement ? 'unpositioned' : '', animate ? 'animate' : ''].join(' ')}>
      {name} tooltip
    </Tooltip>
  </TooltipTrigger>;
}

function Target() {
  const [isOpen, setIsOpen] = useState(false);
  if (!dialog) return <Example name="Target" />;
  return <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
    <Example name="Target" />
    <Popover placement="bottom end"><Dialog aria-label="Example dialog"><p>Optional dialog composition.</p><Button onPress={() => setIsOpen(false)}>Close</Button></Dialog></Popover>
  </DialogTrigger>;
}

function showReport() {
  const result = probe.stop();
  document.querySelector('#report')!.textContent = JSON.stringify(result, null, 2);
}

createRoot(document.getElementById('root')!).render(<main>
  <h1>Tooltip positioning in Firefox</h1>
  <p>Raw React Aria Components. No Stitch, StyleX, Storybook, or application layout provider.</p>
  <p><strong>{synthetic ? 'Synthetic fixture: forced closed + exiting. This is not the real hover race.' : 'Real gesture: uncontrolled TooltipTrigger state.'}</strong></p>
  <div className="header" aria-label="Reproduction area">
    <div id="blank">Empty space: click here and leave the pointer here after a brief hover.</div>
    <Example name="Warmup" /><Target />
  </div>
  <ol>
    <li>Start capture. Hover Warmup for 600ms, then move to empty space for 450ms.</li>
    <li>{sweep ? 'After warmup, sweep between Warmup and Target 12 times, about 40ms per button, then return to empty space.' : 'Click empty space. Briefly hover Target (about 40ms), then return to empty space.'}</li>
    <li>Leave the pointer in empty space for at least 3 seconds. Look for a tooltip at the viewport origin.</li>
    <li>Hover Target for at least 900ms. Observe whether it returns to the trigger.</li>
    <li>Repeat if necessary; stop capture to inspect buffered geometry and state changes.</li>
  </ol>
  <p>Mode: {synthetic ? 'synthetic' : 'gesture'}; placement guard: {String(guard)}; exit animation: {String(animate)}; explicit CPU load: {String(load)}.</p>
  <nav aria-label="Configurations">
    <a href="?">Gesture baseline</a> · <a href="?load=1">Gesture with bounded load</a> · <a href="?load=1&guard=1">Load + placement guard</a> · <a href="?mode=synthetic">Synthetic exit</a> · <a href="?mode=synthetic&guard=1">Synthetic + guard</a> · <a href="?load=1&animate=1">Load + exit animation</a> · <a href="?sequence=sweep">Warm row sweep</a> · <a href="?sequence=sweep&animate=1">Sweep + animation</a> · <a href="?composition=dialog&load=1">Dialog target + load</a>
  </nav>
  <p>Diagnostics only sample during capture; results render after stopping. Load mode blocks the main thread for 35ms every 45ms only during capture.</p>
  <button onClick={() => probe.start()}>Start capture</button> <button onClick={showReport}>Stop capture and show diagnostics</button>
  <p>Declared dependency versions: <code>{JSON.stringify(manifest.dependencies)}</code></p>
  <details><summary>Buffered diagnostics</summary><pre id="report">No capture yet.</pre></details>
</main>);
