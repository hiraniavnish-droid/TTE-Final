import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "../contexts/LeadContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "./ui/Modal";
import { EmptyState } from "./ui/EmptyState";
import {
  Search,
  X,
  ArrowRight,
  Users,
  LayoutDashboard,
  CalendarCheck,
  BookUser,
  Handshake,
  Plus,
  Sun,
  Moon,
  Droplets,
  Building2,
  Map,
} from "lucide-react";

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const { leads } = useLeads();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  const close = () => setOpen(false);
  const navigateTo = (path: string) => {
    close();
    navigate(path);
  };
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const records = leads
      .filter(
        (lead) =>
          !term ||
          [
            lead.name,
            lead.leadCode,
            lead.contact?.phone,
            lead.contact?.email,
            lead.tripDetails?.destination,
            ...(lead.tags || []),
          ].some((value) => value?.toLowerCase().includes(term)),
      )
      .slice(0, term ? 7 : 3)
      .map((lead) => ({
        id: lead.id,
        group:
          lead.status === "Won"
            ? "Customers"
            : term
              ? "Leads"
              : "Recent enquiries",
        label: lead.name,
        description: [lead.leadCode, lead.tripDetails?.destination, lead.status]
          .filter(Boolean)
          .join(" · "),
        icon: lead.status === "Won" ? BookUser : Users,
        action: () => navigateTo(`/leads/${lead.id}`),
      }));
    const actions = [
      {
        id: "dashboard",
        label: "Go to Dashboard",
        description: "Overview and analytics",
        icon: LayoutDashboard,
        action: () => navigateTo("/"),
      },
      {
        id: "leads",
        label: "Go to Leads",
        description: "Your sales pipeline",
        icon: Users,
        action: () => navigateTo("/leads"),
      },
      {
        id: "tasks",
        label: "Go to Tasks",
        description: "Reminders and follow-ups",
        icon: CalendarCheck,
        action: () => navigateTo("/reminders"),
      },
      {
        id: "customers",
        label: "Go to Customers",
        description: "Bookings and vendor balances",
        icon: BookUser,
        action: () => navigateTo("/customers"),
      },
      {
        id: "suppliers",
        label: "Go to Suppliers",
        description: "Your vendor directory",
        icon: Handshake,
        action: () => navigateTo("/suppliers"),
      },
      {
        id: "rates",
        label: "Go to Blocked Rates",
        description: "Hotel rate sheets",
        icon: Building2,
        action: () => navigateTo("/blocked-rates"),
      },
      {
        id: "itinerary",
        label: "Itinerary Hub",
        description: "Build trip itineraries",
        icon: Map,
        action: () => navigateTo("/builder"),
      },
      {
        id: "new",
        label: "Add New Lead",
        description: "Create an enquiry",
        icon: Plus,
        action: () => {
          close();
          setTimeout(
            () => window.dispatchEvent(new CustomEvent("open-add-lead")),
            0,
          );
        },
      },
      {
        id: "light",
        label: "Switch to Light Theme",
        description: "Appearance",
        icon: Sun,
        action: () => {
          setTheme("light");
          close();
        },
      },
      {
        id: "dark",
        label: "Switch to Dark Theme",
        description: "Appearance",
        icon: Moon,
        action: () => {
          setTheme("dark");
          close();
        },
      },
      {
        id: "ocean",
        label: "Switch to Ocean Theme",
        description: "Appearance",
        icon: Droplets,
        action: () => {
          setTheme("ocean");
          close();
        },
      },
    ]
      .filter(
        (action) =>
          !term ||
          `${action.label} ${action.description}`.toLowerCase().includes(term),
      )
      .slice(0, term ? 11 : 8)
      .map((action) => ({ ...action, group: "Actions" }));
    return [...records, ...actions].sort((a, b) => {
      const rank = (group: string) =>
        group === "Actions" ? 2 : group === "Customers" ? 1 : 0;
      return rank(a.group) - rank(b.group);
    });
  }, [query, leads, navigate, setTheme, user?.role]);
  useEffect(() => {
    setActive(0);
  }, [query, results.length]);
  const groups = [...new Set(results.map((result) => result.group))];
  return (
    <Modal isOpen={open} onClose={close} title="Search workspace">
      <div className="ui-command">
        <div className="ui-search">
          <Search size={18} />
          <input
            ref={input}
            data-autofocus
            role="combobox"
            aria-label="Search leads, customers and actions"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${id}-results`}
            aria-activedescendant={
              results[active] ? `${id}-option-${active}` : undefined
            }
            placeholder="Search people, trips or actions…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next =
                  (active +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    Math.max(results.length, 1)) %
                  Math.max(results.length, 1);
                setActive(next);
                document
                  .getElementById(`${id}-option-${next}`)
                  ?.scrollIntoView({ block: "nearest" });
              }
              if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                results[active].action();
              }
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear workspace search"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div
          className="ui-command-results"
          id={`${id}-results`}
          role="listbox"
          aria-label="Workspace results"
        >
          {groups.map((group) => (
            <div key={group} role="group" aria-label={group}>
              <h3>{group}</h3>
              {results.map((result, index) => {
                if (result.group !== group) return null;
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    type="button"
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={active === index}
                    tabIndex={-1}
                    className={active === index ? "is-active" : ""}
                    onMouseMove={() => setActive(index)}
                    onClick={result.action}
                  >
                    <span className="ui-command-icon">
                      <Icon size={17} />
                    </span>
                    <span>
                      <strong>{result.label}</strong>
                      <small>{result.description}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {!results.length && (
          <EmptyState
            compact
            title="No matching results"
            description="Search a name, TTE ID, destination or action."
            icon={Search}
          />
        )}
        <p className="ui-command-hint">
          ↑ ↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </Modal>
  );
};
