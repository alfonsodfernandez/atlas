import { mountAtlas } from './app';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el elemento raíz de Atlas.');

const events = new AbortController();
const disposeApp = mountAtlas(root);
const dispose = (): void => {
  events.abort();
  disposeApp();
};
if (import.meta.hot) import.meta.hot.dispose(dispose);

window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) dispose();
  },
  { signal: events.signal },
);
