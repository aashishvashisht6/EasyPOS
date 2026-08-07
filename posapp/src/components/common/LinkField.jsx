import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchLink } from "../../api/Search";
import FieldShell from "./FieldShell";

const DEBOUNCE_MS = 250;

/**
 * Autocomplete field that mirrors Frappe's Link field: types into a text box,
 * queries frappe.desk.search.search_link for the given doctype as you type,
 * and resolves to a docname on selection.
 *
 * value        - selected docname (controlled)
 * onChange     - (docname, option) => void, called on select; (null, null) on clear
 * displayValue - label to show for `value` when not actively editing (e.g. customer_name).
 *                Falls back to `value` itself if omitted.
 * doctype      - Frappe doctype to search
 * filters      - object passed through to search_link as filters
 * renderOption - (option) => ReactNode, custom row rendering
 */
const LinkField = ({
  label,
  doctype,
  value,
  onChange,
  displayValue,
  filters,
  placeholder = "Search...",
  required,
  disabled,
  allowClear = true,
  error,
  help,
  pageLength = 20,
  renderOption,
  size = "sm",
  className = "",
  actionIcon,
  actionTitle,
  onAction,
  onClick,
}) => {
  const id = useId();
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState(null);

  // While not actively editing, the box just reflects what the parent knows (label or raw value).
  const shownValue = isEditing ? query : displayValue ?? value ?? "";

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dropdown is portaled to <body> and positioned with fixed coordinates
  // instead of being absolutely positioned inside `.pos-link-field` — a
  // LinkField used inside any scrollable/overflow ancestor (e.g. ChildTable's
  // horizontal-scroll wrapper) would otherwise get its dropdown clipped or
  // mispositioned by that ancestor. Reposition on scroll (capture, so scroll
  // on a nested container is caught too) and resize while open.
  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      if (containerRef.current) {
        setDropdownRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [isOpen]);

  const runSearch = (txt) => {
    setLoading(true);
    searchLink(doctype, txt, filters, pageLength)
      .then((results) => {
        setOptions(results);
        setHighlightedIndex(results.length ? 0 : -1);
      })
      .finally(() => setLoading(false));
  };

  const handleFocus = () => {
    const currentText = displayValue ?? value ?? "";
    setQuery(currentText);
    setIsOpen(true);
    setIsEditing(true);
    runSearch(currentText);
  };

  const handleInputChange = (text) => {
    setQuery(text);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const selectOption = (option) => {
    onChange?.(option.value, option);
    setQuery(option.label || option.description || option.value);
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleClear = () => {
    onChange?.(null, null);
    setQuery("");
    setOptions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[highlightedIndex]) selectOption(options[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsEditing(false);
    }
  };

  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} help={help}>
      <div className={`pos-link-field ${className}`} ref={containerRef} onClick={onClick}>
        <div className={`input-group input-group-${size}`}>
          <span className="input-group-text">
            <i className="bi bi-search" />
          </span>
          <input
            id={id}
            type="text"
            className={`form-control ${error ? "is-invalid" : ""}`}
            placeholder={placeholder}
            value={shownValue}
            disabled={disabled}
            required={required}
            onFocus={handleFocus}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {allowClear && value && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
            >
              <i className="bi bi-x" />
            </button>
          )}
          {actionIcon && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              title={actionTitle}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onAction}
            >
              <i className={`bi ${actionIcon}`} />
            </button>
          )}
        </div>

        {isOpen &&
          dropdownRect &&
          createPortal(
            <div
              className="pos-link-dropdown"
              style={{
                position: "fixed",
                top: dropdownRect.bottom + 4,
                left: dropdownRect.left,
                width: dropdownRect.width,
                right: "auto",
                // Portaled to <body>, so it escapes any ancestor Modal's
                // stacking context — must out-rank Modal's z-index (1050)
                // or it renders invisibly behind the modal.
                zIndex: 1060,
              }}
            >
              {loading ? (
                <div className="pos-link-empty">
                  <span className="spinner-border spinner-border-sm" role="status" />
                </div>
              ) : options.length === 0 ? (
                <div className="pos-link-empty">No {doctype} found</div>
              ) : (
                options.map((option, index) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`pos-link-option ${index === highlightedIndex ? "active" : ""}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectOption(option);
                    }}
                  >
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <>
                        <div className="pos-link-option-label">{option.value}</div>
                        {option.description && (
                          <div className="pos-link-option-desc">{option.description}</div>
                        )}
                      </>
                    )}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )}
      </div>
    </FieldShell>
  );
};

export default LinkField;
