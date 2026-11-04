import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CreditCard,
  Download,
  IndianRupee,
  MessageSquare,
  Plus,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import {
  DateField,
  SearchSelect,
  SegmentedControl,
  WorkspaceTabs,
  TabPanel,
  TableToolbar,
  SaveChangesBar,
  Choice,
} from "../components/ui/WorkspaceControls";
import {
  ActivityTimeline,
  AnimatedNumber,
  DataTable,
  EmptyState,
  FileDropZone,
  MetricCard,
  TrendChart,
  TableColumn,
} from "../components/ui/WorkspaceVisuals";
import { useTheme } from "../contexts/ThemeContext";
import { formatCurrency } from "../utils/helpers";

const travellers = [
  {
    id: "demo-1",
    name: "Aarav Shah",
    destination: "Rann Utsav",
    stage: "New",
    amount: 85000,
  },
  {
    id: "demo-2",
    name: "Meera & family",
    destination: "Statue of Unity",
    stage: "Proposal sent",
    amount: 42000,
  },
  {
    id: "demo-3",
    name: "The West Coast Travellers",
    destination: "Kutch",
    stage: "Discussion",
    amount: 190000,
  },
];
type Traveller = (typeof travellers)[number];
const sections = [
  "List toolbar",
  "Page tabs",
  "Responsive drawer",
  "Calendar",
  "Empty states",
  "Save changes",
  "Bento dashboard",
  "Metric cards",
  "Trend chart",
  "Activity timeline",
  "Tactile buttons",
  "Number transitions",
  "Searchable selection",
  "Document upload",
  "Responsive table",
  "Command menu",
];
function DemoSection({
  number,
  where,
  children,
  full = false,
}: {
  number: number;
  where: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section id={`demo-${number}`} className={full ? "ui-demo-full" : ""}>
      <Card>
        <div className="ui-demo-title">
          <span>{String(number).padStart(2, "0")}</span>
          <div>
            <h2>{sections[number - 1]}</h2>
            <p>{where}</p>
          </div>
        </div>
        {children}
      </Card>
    </section>
  );
}

export function UIDemo() {
  const { theme, setTheme, getInputClass } = useTheme();
  const [search, setSearch] = useState(""),
    [hidden, setHidden] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState("overview"),
    [drawer, setDrawer] = useState(false),
    [date, setDate] = useState("2027-01-12");
  const [empty, setEmpty] = useState("empty"),
    [name, setName] = useState("Aarav Shah"),
    [savedName, setSavedName] = useState("Aarav Shah");
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [failSave, setFailSave] = useState(false);
  const [period, setPeriod] = useState("month"),
    [number, setNumber] = useState(190000),
    [customer, setCustomer] = useState("");
  const [uploadStatus, setUploadStatus] = useState<
      "idle" | "uploading" | "success" | "error"
    >("idle"),
    [uploadMessage, setUploadMessage] = useState(
      "Simulated demo: no file is transmitted or saved.",
    ),
    [failUpload, setFailUpload] = useState(false);
  const [demoNotice, setDemoNotice] = useState("");
  const filtered = travellers.filter((row) =>
    `${row.name} ${row.destination}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const columns: TableColumn<Traveller>[] = [
    {
      key: "name",
      label: "Traveller",
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label={`Select ${row.name}`}
            checked={selected.includes(row.id)}
            onChange={() =>
              setSelected((current) =>
                current.includes(row.id)
                  ? current.filter((id) => id !== row.id)
                  : [...current, row.id],
              )
            }
          />
          <strong>{row.name}</strong>
        </div>
      ),
    },
    {
      key: "destination",
      label: "Destination",
      sortValue: (row) => row.destination,
      render: (row) => row.destination,
    },
    {
      key: "stage",
      label: "Stage",
      render: (row) => <span className="ui-stage-badge">{row.stage}</span>,
    },
    {
      key: "amount",
      label: "Quote amount",
      align: "right",
      sortValue: (row) => row.amount,
      render: (row) => formatCurrency(row.amount),
    },
  ];
  const exportRows = () => {
    const rows = selected.length
      ? filtered.filter((row) => selected.includes(row.id))
      : filtered;
    const csv = [
      "Name,Destination,Stage,Amount",
      ...rows.map((row) =>
        [row.name, row.destination, row.stage, row.amount]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tte-fictional-demo.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const loadCustomers = useCallback(
    (query: string, signal: AbortSignal) =>
      new Promise<Choice[]>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            resolve(
              travellers
                .filter((row) =>
                  `${row.name} ${row.destination}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((row) => ({
                  value: row.id,
                  label: row.name,
                  description: row.destination,
                })),
            ),
          350,
        );
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Cancelled", "AbortError"));
          },
          { once: true },
        );
      }),
    [],
  );
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (failSave)
      setSaveError("Demo save failed. Your edits are still here—try again.");
    else setSavedName(name);
    setSaving(false);
  };
  const upload = async (file: File) => {
    if (uploadStatus === "uploading") return;
    if (file.size > 25 * 1024 * 1024) {
      setUploadStatus("error");
      setUploadMessage("This file exceeds the 25 MB limit.");
      return;
    }
    setUploadStatus("uploading");
    setUploadMessage(`Simulating upload of ${file.name}…`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUploadStatus(failUpload ? "error" : "success");
    setUploadMessage(
      failUpload
        ? "Demo upload failed. Choose the file again to retry."
        : `${file.name}: demo complete. No file was transmitted or stored.`,
    );
  };
  return (
    <div className="ui-demo">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <p className="ui-demo-eyebrow">TTE WORKSPACE · INTERACTIVE PREVIEW</p>
          <h1 className="mt-2 font-bold">A more thoughtful CRM.</h1>
          <p className="ui-muted text-sm mt-3 max-w-2xl">
            Try every refinement below. These are the shared components used in
            the updated pages, demonstrated with fictional records.
          </p>
        </div>
        <SegmentedControl
          label="Demo appearance"
          value={theme}
          onChange={(value) => setTheme(value as "light" | "dark" | "ocean")}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "ocean", label: "Ocean" },
          ]}
        />
      </div>
      <div className="ui-demo-links">
        <Link to="/">Dashboard ↗</Link>
        <Link to="/leads">Leads ↗</Link>
        <Link to="/customers">Customers ↗</Link>
        <Link to="/rann-utsav-builder">Quotation builder ↗</Link>
      </div>
      <nav className="ui-demo-index" aria-label="Refinement demos">
        {sections.map((label, index) => (
          <a
            key={label}
            href={`#/ui-demo#demo-${index + 1}`}
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById(`demo-${index + 1}`)
                ?.scrollIntoView({ block: "start", behavior: "instant" });
            }}
          >
            {String(index + 1).padStart(2, "0")} {label}
          </a>
        ))}
      </nav>
      <div className="ui-demo-grid">
        <DemoSection number={1} where="Leads and Customers" full>
          <TableToolbar
            label="Demo enquiries"
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setSelected([]);
            }}
            placeholder="Search the fictional enquiries…"
            columns={columns.map((column) => ({
              key: column.key,
              label: column.label,
              visible: !hidden.includes(column.key),
            }))}
            onToggleColumn={(key) =>
              setHidden((current) =>
                current.includes(key)
                  ? current.filter((item) => item !== key)
                  : [...current, key],
              )
            }
            onExport={exportRows}
            selectionCount={selected.length}
            onClearSelection={() => setSelected([])}
          />
          <p className="ui-demo-note">
            Search here, select rows in demo 15, choose columns or export the
            matching fictional records. The table below uses the same state.
          </p>
        </DemoSection>
        <DemoSection number={2} where="Lead details">
          <WorkspaceTabs
            id="tour"
            label="Demo lead sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "trip", label: "Trip" },
              { value: "quotes", label: "Quotes" },
            ]}
          />
          <TabPanel id="tour" value="overview" active={tab}>
            <p className="text-sm">
              Everything about this enquiry, in one workspace.
            </p>
          </TabPanel>
          <TabPanel id="tour" value="trip" active={tab}>
            <p className="text-sm">
              Rann Utsav · 3 nights · 9 adults + 2 children
            </p>
          </TabPanel>
          <TabPanel id="tour" value="quotes" active={tab}>
            <p className="text-sm">
              Non-AC Swiss Cottage · {formatCurrency(190000)}
            </p>
          </TabPanel>
          <p className="ui-demo-note">
            Use the arrow keys to move between tabs.
          </p>
        </DemoSection>
        <DemoSection number={3} where="All shared CRM dialogs">
          <Button onClick={() => setDrawer(true)}>
            <Plus size={16} />
            Open enquiry form
          </Button>
          <p className="ui-demo-note">
            A centered dialog on desktop, a bottom drawer on phones. Try Tab,
            Escape and the nested calendar.
          </p>
          <Modal
            isOpen={drawer}
            onClose={() => setDrawer(false)}
            title="Demo enquiry"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setDemoNotice("Demo enquiry reviewed. No record was saved.");
                setDrawer(false);
              }}
              className="space-y-4"
            >
              <label className="block text-sm">
                Traveller name
                <input
                  data-autofocus
                  className={`block w-full p-3 mt-2 ${getInputClass()}`}
                  defaultValue="Demo traveller"
                  required
                />
              </label>
              <label className="block text-sm">
                Check-in
                <DateField
                  label="Demo enquiry check-in"
                  value={date}
                  onValueChange={setDate}
                />
              </label>
              <label className="block text-sm">
                Notes
                <textarea
                  className={`block w-full p-3 mt-2 ${getInputClass()}`}
                  rows={4}
                  placeholder="Enquiry notes…"
                />
              </label>
              <Button type="submit">Review demo enquiry</Button>
              <p className="ui-demo-note">
                Fictional demo. No booking or lead is created.
              </p>
            </form>
          </Modal>
          <p role="status" className="ui-demo-note">
            {demoNotice}
          </p>
        </DemoSection>
        <DemoSection number={4} where="Quotation builders and date filters">
          <DateField
            label="Demo travel date"
            value={date}
            onValueChange={setDate}
            min="2026-11-01"
            max="2027-03-31"
          />
          <p className="ui-demo-note">
            Type a date or use the calendar. Demo season: 1 November 2026–31
            March 2027. Dates remain date-only values.
          </p>
        </DemoSection>
        <DemoSection number={5} where="Lists, payments and document history">
          <SegmentedControl
            label="Empty state demo"
            value={empty}
            onChange={setEmpty}
            options={[
              { value: "empty", label: "Empty" },
              { value: "search", label: "No results" },
              { value: "error", label: "Error" },
            ]}
          />
          <EmptyState
            title={
              empty === "error"
                ? "This view could not load"
                : empty === "search"
                  ? "No matching enquiries"
                  : "Your next journey starts here"
            }
            description={
              empty === "error"
                ? "Your records are still safe. Retry when you’re ready."
                : empty === "search"
                  ? "Try another search or clear your filters."
                  : "Create an enquiry to begin your next booking."
            }
            icon={empty === "search" ? Search : Users}
            error={empty === "error"}
            action={{
              label:
                empty === "error"
                  ? "Retry demo"
                  : empty === "search"
                    ? "Clear filters"
                    : "Create enquiry",
              onClick: () => {
                if (empty === "empty") setDrawer(true);
                else setEmpty("empty");
              },
            }}
          />
        </DemoSection>
        <DemoSection number={6} where="Lead profile editing">
          <label className="block text-sm">
            Demo traveller name
            <input
              aria-label="Demo traveller name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              className={`block mt-2 w-full p-3 ${getInputClass()}`}
            />
          </label>
          <label className="ui-demo-check">
            <input
              type="checkbox"
              checked={failSave}
              onChange={(event) => setFailSave(event.target.checked)}
            />
            Simulate a save failure
          </label>
          <SaveChangesBar
            dirty={name !== savedName}
            saving={saving}
            error={saveError}
            onSave={save}
            onDiscard={() => {
              setName(savedName);
              setSaveError("");
            }}
          />
          <p className="ui-demo-note">
            Edit the name to reveal Save / Discard. A failed save retains the
            edit. This demonstration never writes to the CRM.
          </p>
        </DemoSection>
        <DemoSection number={7} where="Dashboard hierarchy" full>
          <div className="ui-bento-demo">
            <MetricCard
              featured
              label="Demo booking value"
              value={period === "month" ? 317000 : 190000}
              format={formatCurrency}
              caption="Primary insight, without a large header"
              icon={IndianRupee}
            />
            <div className="ui-bento-support">
              <MetricCard
                label="Demo enquiries"
                value={period === "month" ? 24 : 12}
                icon={Users}
              />
              <MetricCard
                label="Demo follow-ups"
                value={7}
                icon={CalendarDays}
              />
            </div>
          </div>
        </DemoSection>
        <DemoSection number={8} where="Dashboard KPI cards">
          <div className="mb-4">
            <SegmentedControl
              label="Demo metric period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "month", label: "This month" },
                { value: "week", label: "This week" },
              ]}
            />
          </div>
          <MetricCard
            label="Demo collections"
            value={period === "month" ? 190000 : 85000}
            format={formatCurrency}
            caption="A consistent label, value and supporting line"
            icon={CreditCard}
          />
        </DemoSection>
        <DemoSection number={9} where="Dashboard enquiry trend">
          <TrendChart
            title="Demo enquiry trend"
            description="Fictional daily enquiries"
            data={(period === "month"
              ? [4, 8, 6, 12, 9, 15, 18]
              : [2, 5, 3, 7, 4, 8, 12]
            ).map((value, index) => ({ label: `${index + 1} Nov`, value }))}
          />
        </DemoSection>
        <DemoSection number={10} where="Lead activity and chat history">
          <ActivityTimeline
            events={[
              {
                id: "quote",
                type: "Quotation",
                actor: "Demo adviser",
                timestamp: "2026-11-04T09:15:00+05:30",
                content:
                  "Shared 3 nights in a Non-AC Swiss Cottage. Client requested the itinerary.",
              },
              {
                id: "call",
                type: "Call",
                actor: "Demo adviser",
                timestamp: "2026-11-04T08:30:00+05:30",
                content: "Confirmed 9 adults and 2 children for 12–15 January.",
              },
              {
                id: "note",
                type: "Note",
                timestamp: "2026-11-03T16:00:00+05:30",
                content: "New Rann Utsav enquiry received.",
              },
            ]}
          />
        </DemoSection>
        <DemoSection
          number={11}
          where="All shared primary and secondary actions"
        >
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => setDemoNotice("Primary action clicked.")}>
              <Plus size={16} />
              New lead
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDemoNotice("Secondary action clicked.")}
            >
              <Download size={16} />
              Export
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDemoNotice("Ghost action clicked.")}
            >
              View details
            </Button>
            <Button disabled>Unavailable</Button>
          </div>
          <p className="ui-demo-note" role="status">
            {demoNotice ||
              "Subtle depth, visible focus and clear disabled states. Try the controls with a keyboard."}
          </p>
        </DemoSection>
        <DemoSection number={12} where="Changing dashboard values">
          <div className="ui-demo-number">
            <AnimatedNumber value={number} format={formatCurrency} />
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            <Button
              variant="secondary"
              onClick={() => setNumber((value) => value + 15000)}
            >
              Add ₹15,000
            </Button>
            <Button variant="ghost" onClick={() => setNumber(190000)}>
              Reset value
            </Button>
          </div>
          <p className="ui-demo-note">
            Numbers transition after a change and respect reduced-motion
            settings.
          </p>
        </DemoSection>
        <DemoSection number={13} where="Owners, vendors and payment customers">
          <SearchSelect
            label="Demo customer"
            value={customer}
            onChange={setCustomer}
            loadOptions={loadCustomers}
            placeholder="Search a demo customer…"
          />
          <p className="ui-demo-note">
            Try “Meera” or “Kutch”. This demo simulates a short request and
            cancels outdated searches; the CRM uses its existing authorized
            record lists.
          </p>
        </DemoSection>
        <DemoSection number={14} where="Lead documents">
          <FileDropZone
            onFile={(file) => void upload(file)}
            status={uploadStatus}
            message={uploadMessage}
          />
          <label className="ui-demo-check">
            <input
              type="checkbox"
              checked={failUpload}
              onChange={(event) => setFailUpload(event.target.checked)}
            />
            Simulate an upload failure
          </label>
          <p className="ui-demo-note">
            Demo only. Selected file contents never leave your device. The CRM
            Documents tab connects this same control to its existing upload
            service.
          </p>
        </DemoSection>
        <DemoSection number={15} where="Customer and vendor accounts" full>
          <DataTable
            label="Demo bookings"
            rows={filtered}
            columns={columns.filter((column) => !hidden.includes(column.key))}
            rowKey={(row) => row.id}
            onClearFilters={() => setSearch("")}
          />
          <p className="ui-demo-note">
            Sortable headings on desktop, labelled cards on phones. Use demo 01
            to search, choose columns or export.
          </p>
        </DemoSection>
        <DemoSection number={16} where="Existing workspace search" full>
          <Button
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  ctrlKey: true,
                  bubbles: true,
                }),
              )
            }
          >
            <Search size={16} />
            Open workspace search
          </Button>
          <p className="ui-demo-note">
            The actual command menu searches the records available to the
            signed-in user. Use ↑ ↓, Enter and Escape, or open it with Ctrl/⌘ K.
            In the local preview those records are fictional.
          </p>
        </DemoSection>
      </div>
    </div>
  );
}
