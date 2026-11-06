import { EmptyState } from "./EmptyState";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../utils/helpers";

export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString("en-IN"),
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const start = previous.current;
    previous.current = value;
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    const controls = animate(start, value, {
      duration: 0.35,
      ease: "easeOut",
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <span className="ui-number">
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export { EmptyState } from "./EmptyState";

export function MetricCard({
  label,
  value,
  format,
  caption,
  icon: Icon,
  featured = false,
  delta,
}: {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  caption?: string;
  icon?: React.ElementType;
  featured?: boolean;
  delta?: string;
}) {
  return (
    <div className={cn("ui-metric", featured && "is-featured")}>
      <div className="ui-metric-heading">
        <span>{label}</span>
        {Icon && <Icon size={19} aria-hidden="true" />}
      </div>
      <strong>
        {value === null ? (
          <span aria-label="Not available">—</span>
        ) : (
          <AnimatedNumber value={value} format={format} />
        )}
      </strong>
      {delta && <span className="ui-metric-delta">{delta}</span>}
      {caption && <p>{caption}</p>}
    </div>
  );
}

export function TrendChart({
  title,
  description,
  data,
  valueLabel = "Enquiries",
  format = (n: number) => n.toLocaleString("en-IN"),
}: {
  title: string;
  description: string;
  data: { label: string; value: number }[];
  valueLabel?: string;
  format?: (value: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  return (
    <div className="ui-trend">
      <div className="ui-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="ui-chart-legend">
          <i />
          {valueLabel}
        </span>
      </div>
      {data.length ? (
        <>
          <div
            className="ui-chart"
            role="img"
            aria-label={`${title}. ${data.map((d) => `${d.label}: ${format(d.value)}`).join("; ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--crm-accent)"
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--crm-accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--crm-border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--crm-muted)", fontSize: 11 }}
                  minTickGap={30}
                  tickMargin={12}
                />
                <YAxis
                  allowDecimals={false}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--crm-muted)", fontSize: 11 }}
                  tickFormatter={format}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--crm-surface)",
                    color: "var(--crm-text)",
                    border: "1px solid var(--crm-border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(value) => [format(Number(value)), valueLabel]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={valueLabel}
                  stroke="var(--crm-accent)"
                  strokeWidth={2.5}
                  fill={`url(#fill-${id})`}
                  isAnimationActive={!reduced}
                  animationDuration={350}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="ui-chart-data">
            <summary>View chart data</summary>
            <table>
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>{valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index}>
                    <th scope="row">{row.label}</th>
                    <td>{format(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <EmptyState
          compact
          title="No trend data yet"
          description="Your recorded activity will appear here when it’s available."
        />
      )}
    </div>
  );
}

export interface TimelineEvent {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  actor?: string;
}
export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  );
  if (!sorted.length)
    return (
      <EmptyState
        compact
        title="Your history starts here"
        description="Calls, notes and updates will appear in this timeline."
        icon={FileText}
      />
    );
  let previousDay = "";
  return (
    <ol className="ui-timeline">
      {sorted.map((event) => {
        const date = new Date(event.timestamp),
          valid = !Number.isNaN(date.getTime());
        const day = valid
          ? date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Date unavailable";
        const showDay = day !== previousDay;
        previousDay = day;
        return (
          <li key={event.id}>
            {showDay && <h4>{day}</h4>}
            <div className="ui-timeline-event">
              <span className="ui-timeline-dot" aria-hidden="true" />
              <div>
                <div className="ui-timeline-meta">
                  <strong>
                    {event.type === "StatusChange"
                      ? "Stage updated"
                      : event.type}
                  </strong>
                  <span>{event.actor || ""}</span>
                  {valid && (
                    <time dateTime={date.toISOString()}>
                      {date.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  )}
                </div>
                <p>{event.content}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FileDropZone({
  onFile,
  status = "idle",
  message,
  accept,
  disabled,
}: {
  onFile: (file: File) => void;
  status?: "idle" | "uploading" | "success" | "error";
  message?: string;
  accept?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = disabled || status === "uploading";
  const choose = (files?: FileList | null) => {
    if (!busy && files?.[0]) onFile(files[0]);
  };
  const Icon =
    status === "uploading"
      ? Loader2
      : status === "success"
        ? CheckCircle2
        : status === "error"
          ? XCircle
          : UploadCloud;
  return (
    <div
      className={cn("ui-upload", dragging && "is-dragging", `is-${status}`)}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        choose(event.dataTransfer.files);
      }}
    >
      <Icon
        size={25}
        aria-hidden="true"
        className={status === "uploading" ? "animate-spin" : ""}
      />
      <strong>
        {status === "uploading"
          ? "Uploading your document…"
          : "Drop a document here"}
      </strong>
      <p role={status === "error" ? "alert" : "status"}>
        {message || "Or choose a file from your device. Up to 25 MB per file."}
      </p>
      {status === "uploading" && (
        <div
          className="ui-upload-progress"
          role="progressbar"
          aria-label="Uploading document"
        >
          <span />
        </div>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Choose file
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        aria-label="Choose document"
        disabled={busy}
        onChange={(event) => {
          choose(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "right";
}
export function DataTable<T>({
  label,
  rows,
  columns,
  rowKey,
  limit = Infinity,
  emptyTitle = "No matching records",
  emptyDescription = "Try changing the filters or search.",
  onClearFilters,
}: {
  key?: React.Key;
  label: string;
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  limit?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
}) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(
    null,
  );
  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!column?.sortValue || !sort) return rows;
    return [...rows].sort((a, b) => {
      const x = column.sortValue!(a),
        y = column.sortValue!(b);
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "en-IN", { numeric: true })) *
        (sort.descending ? -1 : 1)
      );
    });
  }, [rows, columns, sort]);
  if (!rows.length)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={Search}
        action={
          onClearFilters
            ? { label: "Clear filters", onClick: onClearFilters }
            : undefined
        }
      />
    );
  return (
    <div className="ui-data-table">
      <div className="ui-table-scroll">
        <table aria-label={label}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort?.key === column.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={column.align === "right" ? "is-numeric" : ""}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort({
                          key: column.key,
                          descending:
                            sort?.key === column.key ? !sort.descending : false,
                        })
                      }
                    >
                      {column.label}
                      {sort?.key === column.key ? (
                        sort.descending ? (
                          <ArrowDown size={13} />
                        ) : (
                          <ArrowUp size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === "right" ? "is-numeric" : ""}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ui-table-mobile" aria-label={`${label}, cards`}>
        {sorted.slice(0, limit).map((row) => (
          <article key={rowKey(row)}>
            {columns.map((column, index) =>
              index === 0 ? (
                <h3 key={column.key}>{column.render(row)}</h3>
              ) : (
                <div className="ui-mobile-field" key={column.key}>
                  <span>{column.label}</span>
                  <div>{column.render(row)}</div>
                </div>
              ),
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
