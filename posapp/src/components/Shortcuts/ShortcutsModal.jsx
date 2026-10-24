import { Modal } from "../common";
import { SHORTCUTS, displayKeys } from "../../utils/keyboardShortcuts";
import "./style.css";

// Static reference for the POS Terminal's keyboard shortcuts, opened with "?".
const ShortcutsModal = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" subtitle="Work the till without reaching for the mouse.">
    <div className="pos-shortcut-list">
      {SHORTCUTS.map((shortcut) => (
        <div key={shortcut.id} className="pos-shortcut-row">
          <span>{shortcut.label}</span>
          <span className="pos-shortcut-keys">
            {shortcut.keys.map((combo, i) => (
              <span key={combo} className="pos-shortcut-combo">
                {i > 0 && <span className="pos-shortcut-or">or</span>}
                {displayKeys(combo).map((part) => (
                  <kbd key={part} className="pos-kbd">
                    {part}
                  </kbd>
                ))}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
    <p className="pos-shortcut-note">
      Shortcuts are ignored while you're typing in a field, except Take payment. Scanning a barcode works anywhere
      without clicking the search box first.
    </p>
  </Modal>
);

export default ShortcutsModal;
