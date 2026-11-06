import React, { useEffect, useId, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Download,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "../../utils/helpers";

const CalendarPicker = React.lazy(() => import("./CalendarPicker"));

export interface Choice {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Filter buttons deliberately use aria-pressed, rather than pretending to be tab panels. */
export function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="ui-segments" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function WorkspaceTabs({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          id={`${id}-tab-${option.value}`}
          role="tab"
          aria-selected={value === option.value}
          aria-controls={`${id}-panel-${option.value}`}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const index = options.findIndex((o) => o.value === option.value);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      options.length) %
                    options.length;
            onChange(options[next].value);
            document
              .getElementById(`${id}-tab-${options[next].value}`)
              ?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  value,
  active,
  children,
}: {
  id: string;
  value: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <section
      role="tabpanel"
      id={`${id}-panel-${value}`}
      aria-labelledby={`${id}-tab-${value}`}
      hidden={value !== active}
    >
      {children}
    </section>
  );
}

function localDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}
function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Native date editing and form validation remain available alongside a keyboard-friendly calendar. */
export function DateField({
  value,
  onValueChange,
  label,
  className,
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & { value: string; onValueChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const selected = localDate(value);
  const min = localDate(props.min?.toString()),
    max = localDate(props.max?.toString());
  return (
    <>
      <span className={cn("ui-date-field", className)}>
        <input
          {...props}
          id={props.id || inputId}
          type="date"
          aria-label={label}
          value={value || ""}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <button
          type="button"
          disabled={props.disabled || props.readOnly}
          aria-label={`Open calendar for ${label.toLowerCase()}`}
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={17} />
        </button>
      </span>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={label}>
        <div className="ui-calendar">
          <React.Suspense
            fallback={
              <p role="status" className="ui-muted text-sm">
                Loading calendar…
              </p>
            }
          >
            <CalendarPicker
              mode="single"
              selected={selected}
              defaultMonth={selected || min}
              disabled={[
                ...(min ? [{ before: min }] : []),
                ...(max ? [{ after: max }] : []),
              ]}
              onSelect={(date) => {
                if (date) {
                  onValueChange(dateValue(date));
                  setOpen(false);
                }
              }}
            />
          </React.Suspense>
        </div>
        <p className="ui-muted text-xs mt-3">
          Choose a day, or type the date directly in the field.
        </p>
      </Modal>
    </>
  );
}

type SelectProps = {
  label: string;
  value: string;
  options?: Choice[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<Choice[]>;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
};
export function SearchSelect({
  label,
  value,
  options = [],
  loadOptions,
  onChange,
  placeholder = "Select an option",
  disabled,
  allowClear = true,
}: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Choice[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [active, setActive] = useState(0),
    [attempt, setAttempt] = useState(0);
  const [remembered, setRemembered] = useState<Choice | undefined>();
  const ref = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null);
  const available = loadOptions
    ? remote
    : options.filter((option) =>
        `${option.label} ${option.description || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
  const selected =
    options.find((option) => option.value === value) ||
    remote.find((option) => option.value === value) ||
    (remembered?.value === value ? remembered : undefined) ||
    (value ? { value, label: value } : undefined);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    inputRef.current?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  useEffect(() => {
    if (!open || !loadOptions) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      loadOptions(query, controller.signal)
        .then((rows) => {
          if (!controller.signal.aborted) setRemote(rows);
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setRemote([]);
            setError(err?.message || "Options could not load.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, loadOptions, attempt]);
  useEffect(() => {
    setActive(0);
  }, [query, available.length]);
  const choose = (option: Choice) => {
    if (option.disabled) return;
    setRemembered(option);
    onChange(option.value);
    setOpen(false);
    ref.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
  };
  return (
    <div className="ui-search-select" ref={ref}>
      <button
        type="button"
        className="ui-select-trigger"
        aria-label={`${label}: ${selected?.label || placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
      >
        <span className={selected ? "" : "ui-muted"}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="ui-select-menu">
          <div className="ui-select-search">
            <Search size={15} />
            <input
              ref={inputRef}
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                available[active] ? `${id}-option-${active}` : undefined
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  ref.current
                    ?.querySelector<HTMLButtonElement>(":scope > button")
                    ?.focus();
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const next =
                    (active +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      Math.max(available.length, 1)) %
                    Math.max(available.length, 1);
                  setActive(next);
                  document
                    .getElementById(`${id}-option-${next}`)
                    ?.scrollIntoView({ block: "nearest" });
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (available[active] && !loading) choose(available[active]);
                }
                if (event.key === "Tab") setOpen(false);
              }}
            />
          </div>
          {loading && (
            <p className="ui-select-state" role="status">
              <Loader2 size={15} className="animate-spin" />
              Loading options…
            </p>
          )}
          {error && (
            <div className="ui-select-state" role="alert">
              {error}
              <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            aria-busy={loading}
          >
            {!loading &&
              available.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={value === option.value}
                  aria-disabled={option.disabled}
                  className={cn(
                    active === index && "is-active",
                    option.disabled && "is-disabled",
                  )}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span>
                    {option.label}
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {value === option.value && <Check size={15} />}
                </li>
              ))}
          </ul>
          {!loading && !error && available.length === 0 && (
            <p className="ui-select-state" role="status">
              No options match your search.
            </p>
          )}
          {allowClear && value && (
            <button
              type="button"
              className="ui-select-clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TableToolbar({
  label = "Table controls",
  search,
  onSearch,
  placeholder = "Search…",
  columns,
  onToggleColumn,
  onExport,
  exportDisabled,
  selectionCount = 0,
  onClearSelection,
  children,
}: {
  label?: string;
  search: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  columns?: { key: string; label: string; visible: boolean }[];
  onToggleColumn?: (key: string) => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  selectionCount?: number;
  onClearSelection?: () => void;
  children?: React.ReactNode;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  return (
    <div className="ui-table-toolbar" role="group" aria-label={label}>
      <div className="ui-toolbar-main">
        <label className="ui-search">
          <Search size={17} />
          <input
            aria-label={
              label === "Table controls"
                ? "Search rows"
                : `Search ${label.toLowerCase()}`
            }
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <div className="ui-toolbar-actions">
          {children}
          {columns && onToggleColumn && (
            <Button variant="secondary" onClick={() => setColumnsOpen(true)}>
              <Columns3 size={15} />
              Columns
            </Button>
          )}
          {onExport && (
            <Button
              variant="secondary"
              disabled={exportDisabled}
              onClick={onExport}
            >
              <Download size={15} />
              Export
            </Button>
          )}
        </div>
      </div>
      {selectionCount > 0 && (
        <div className="ui-selection-bar" role="status">
          <span>{selectionCount} selected</span>
          <button type="button" onClick={onClearSelection}>
            Clear selection
          </button>
        </div>
      )}
      <Modal
        isOpen={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Visible columns"
      >
        <div className="ui-column-options">
          {columns?.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={column.visible}
                disabled={
                  column.visible &&
                  columns.filter((c) => c.visible).length === 1
                }
                onChange={() => onToggleColumn?.(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function SaveChangesBar({
  dirty,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onDiscard: () => void;
}) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!dirty && !saving) return null;
  return (
    <div className="ui-save-bar">
      <div>
        <strong>Unsaved changes</strong>
        <p role={error ? "alert" : "status"}>
          {error ||
            (saving
              ? "Saving your changes…"
              : "Save when you’re ready, or discard your edits.")}
        </p>
      </div>
      <div className="ui-save-actions">
        <Button variant="secondary" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button disabled={saving} onClick={onSave}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
