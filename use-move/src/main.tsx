import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useMove } from 'react-aria';
import './style.css';

type Mode = 'raw' | 'snapshot' | 'rollback';
type Entry = { source: 'native' | 'useMove' | 'policy'; [key: string]: unknown };
const modeNames: Record<Mode, string> = {
  raw: 'Raw useMove with commit on end',
  snapshot: 'Snapshot + Escape reset',
  rollback: 'Consumer rollback policy',
};
const requestedMode = new URLSearchParams(location.search).get('mode');
const initialMode: Mode = requestedMode === 'snapshot' || requestedMode === 'rollback' ? requestedMode : 'raw';

function App() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [preview, setPreview] = useState(0);
  const [committed, setCommitted] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const handleRef = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const snapshot = useRef(0);
  const pointer = useRef<number | null>(null);
  const pointerMoving = useRef(false);
  const discarded = useRef(false);
  const activeMode = useRef(mode);
  activeMode.current = mode;
  const log = (entry: Entry) => setEntries(previous => [...previous.slice(-99), entry]);
  const position = (next: number) => { current.current = next; setPreview(next); };
  const discard = (reason: string) => {
    if (!pointerMoving.current || discarded.current) return;
    discarded.current = true;
    position(snapshot.current);
    log({ source: 'policy', action: 'discard', reason, restored: snapshot.current });
  };

  const { moveProps } = useMove({
    onMoveStart(event) {
      log({ source: 'useMove', callback: 'onMoveStart', ...event });
      if (activeMode.current === 'rollback' && pointerMoving.current && event.pointerType === 'keyboard') return;
      snapshot.current = current.current;
      if (event.pointerType !== 'keyboard') { pointerMoving.current = true; discarded.current = false; }
    },
    onMove(event) {
      log({ source: 'useMove', callback: 'onMove', ...event });
      if (activeMode.current === 'rollback' && (discarded.current || (pointerMoving.current && event.pointerType === 'keyboard'))) return;
      position(current.current + event.deltaX);
    },
    onMoveEnd(event) {
      log({ source: 'useMove', callback: 'onMoveEnd', ...event });
      if (activeMode.current === 'rollback' && pointerMoving.current && event.pointerType === 'keyboard') return;
      if (activeMode.current !== 'rollback' || !discarded.current) setCommitted(current.current);
      if (event.pointerType !== 'keyboard') { pointerMoving.current = false; pointer.current = null; discarded.current = false; }
    },
  });

  useEffect(() => {
    function observe(event: Event) {
      if (event instanceof PointerEvent) {
        log({ source: 'native', type: event.type, pointerId: event.pointerId, pointerType: event.pointerType, button: event.button, isTrusted: event.isTrusted });
        if (event.type === 'pointerdown' && handleRef.current?.contains(event.target as Node) && event.button === 0 && pointer.current === null) pointer.current = event.pointerId;
        if (event.pointerId === pointer.current && (event.type === 'pointerup' || event.type === 'pointercancel')) {
          if (activeMode.current === 'rollback' && event.type === 'pointercancel') discard('native pointercancel');
          // Movement-less presses have no useMove end callback to release ownership.
          if (!pointerMoving.current) pointer.current = null;
        }
      } else if (event instanceof KeyboardEvent) {
        log({ source: 'native', type: event.type, key: event.key, isTrusted: event.isTrusted });
        if (activeMode.current === 'rollback' && event.key === 'Escape' && pointerMoving.current && !discarded.current) {
          event.preventDefault();
          event.stopPropagation();
          discard('Escape');
        }
      }
    }
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.addEventListener(type, observe, true);
    return () => { for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown']) window.removeEventListener(type, observe, true); };
  }, []);

  function reset() {
    if (pointer.current !== null) return;
    position(0); setCommitted(0); setEntries([]); snapshot.current = 0;
  }

  function runSyntheticScenario(kind: 'release' | 'cancel' | 'secondary') {
    if (pointer.current !== null || !handleRef.current) return;
    reset();
    const element = handleRef.current;
    element.focus();
    const dispatch = (type: string, x: number, pointerId = 1) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerType: 'mouse', pointerId,
      button: type === 'pointerdown' ? 0 : -1,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      clientX: x, clientY: 500,
    }));
    dispatch('pointerdown', 100);
    if (kind === 'secondary') dispatch('pointerdown', 110, 2);
    dispatch('pointermove', 160);
    if (kind === 'secondary') dispatch('pointercancel', 110, 2);
    dispatch(kind === 'cancel' ? 'pointercancel' : 'pointerup', 160);
  }

  return <main>
    <h1>useMove cancellation</h1>
    <p>A minimal public React Aria example. Compare normal release, native cancellation, and the maintainer's proposed Escape snapshot/reset pattern.</p>
    <p><a href="https://github.com/adobe/react-spectrum/issues/10652">Upstream issue #10652</a> · <a href="https://github.com/adobe/react-spectrum/issues/10652#issuecomment-5920842054">Maintainer question</a></p>
    <label>Example mode <select value={mode} onChange={event => { const next = event.target.value as Mode; location.search = `mode=${next}`; setMode(next); }}>
      {Object.entries(modeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <p className="explanation">{mode === 'raw' ? 'Raw callbacks drive preview; every onMoveEnd commits. Native events are observed for comparison only.' : mode === 'snapshot' ? 'Faithful minimal interpretation of the suggested approach: onMoveStart saves the position; a focused target’s Escape onKeyDown restores it. No extra cancellation flag is added.' : 'Consumer policy adds an owning-pointer native-cancel listener, ignores keyboard updates during pointer drag, and suppresses remaining updates/commit after rollback until release.'}</p>
    <ol><li>Tab to the blue handle so Escape reaches its onKeyDown handler.</li><li>Drag right. Press Escape while holding, continue dragging, then release.</li><li>Compare preview/committed values and the native input and public callback logs.</li></ol>
    <div className="values"><span>Preview: <strong data-testid="preview">{preview}</strong> px</span><span>Committed: <strong data-testid="committed">{committed}</strong> px</span><button onClick={reset}>Reset</button></div>
    <div className="track"><div ref={handleRef} {...moveProps} className="handle" role="button" aria-label="Drag handle" tabIndex={0} style={{ transform: `translateX(${preview}px)` }} onKeyDown={event => {
      moveProps.onKeyDown?.(event);
      if (mode === 'snapshot' && event.key === 'Escape') { position(snapshot.current); log({ source: 'policy', action: 'snapshot reset', restored: snapshot.current }); }
    }}>Drag me</div></div>
    <p>Browser-generated mouse/key input has <code>isTrusted: true</code>. The buttons below and most automated cancellation/multiple-pointer cases dispatch synthetic <code>PointerEvent</code>s on this handle. A separate Chromium test generates trusted touch cancellation through its browser protocol. Neither method claims to reproduce a physical OS cancellation gesture.</p>
    <fieldset><legend>Run a labelled synthetic pointer sequence</legend><button onClick={() => runSyntheticScenario('release')}>Normal release</button><button onClick={() => runSyntheticScenario('cancel')}>Driving pointercancel</button><button onClick={() => runSyntheticScenario('secondary')}>Second pointercancel, then release driver</button></fieldset>
    <div className="logs"><section><h2>Native input</h2><pre data-testid="native-log">{entries.filter(entry => entry.source === 'native').map(entry => JSON.stringify(entry)).join('\n') || 'No input yet.'}</pre></section><section><h2>Public useMove callbacks + consumer policy</h2><pre data-testid="callback-log">{entries.filter(entry => entry.source !== 'native').map(entry => JSON.stringify(entry)).join('\n') || 'No callbacks yet.'}</pre></section></div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
