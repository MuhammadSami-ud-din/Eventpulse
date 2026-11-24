import { Icon } from './Icon.jsx';
import { Modal } from './Modal.jsx';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  [[MOD, 'K'], 'Open the command palette (pages, events, actions)'],
  [['/'], 'Search on this page (or open the palette)'],
  [['?'], 'Show these shortcuts'],
  [['↑', '↓'], 'Move through the sidebar links and palette results'],
  [['Enter'], 'Open the highlighted link or result'],
  [['Esc'], 'Close a dialog, menu or the mobile menu'],
];

export function ShortcutsDialog({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} label="Keyboard shortcuts" className="modal--shortcuts">
      <div className="shortcuts">
        <div className="shortcuts__header">
          <h2 className="shortcuts__title">Keyboard shortcuts</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <dl className="shortcuts__list">
          {SHORTCUTS.map(([keys, description]) => (
            <div key={description} className="shortcuts__row">
              <dt>
                {keys.map((key) => (
                  <kbd key={key} className="kbd">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}
