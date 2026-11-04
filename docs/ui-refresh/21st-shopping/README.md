# 21st.dev shopping list for TTE CRM

> Implementation update: all 16 shortlisted patterns have now been adapted into the CRM review branch. See [the refinement report](../REFINEMENTS.md) and the protected `/#/ui-demo` route. The remainder of this document records the original shopping review.

Reviewed 4 November 2026 in the signed-in Chrome account. Open `index.html` for the visual collection, or use the direct listing links below.

## Recommendation

Use a compact, calm workspace with a few expressive details: blue primary actions with subtle depth, a clear type hierarchy, softly tinted metric surfaces, responsive drawers, and brief transitions when the user changes something. Apply these through shared components so the quotation, customer, payment and lead pages feel related.

Start with **the list toolbar, inner-page tabs, mobile dialogs, calendar inputs and empty states**. Then refine dashboard cards, charts and activity history. Button texture and number transitions are finishing touches. Keep the recently removed desktop header and lead-temperature controls out of the design.

This is a researched shortlist, not an installation or production deployment. Catalog previews and visible usage examples were inspected; full implementation source was not unlocked. The account showed **2 free source views remaining**. No views were spent, no subscription was purchased, and no package was installed. Free source access is quota-limited even on components with permissive licenses.

## Selected components

The license column records what the listing displayed. Preserve the actual upstream license and copyright notices when importing source; review any bundled media separately. Compatibility notes below are an initial assessment from the visible usage examples and listing metadata, not a completed React 19 accessibility audit.

| Component | CRM use | Adaptation required | Listing license |
| --- | --- | --- | --- |
| [Data Table Toolbar · @uai](https://21st.dev/@skovhm/components/data-table-toolbar) | Leads, Customers, Payments: one compact search, columns and export strip; selection actions appear only when needed. | Wire existing query state, permission checks and real export handlers. Demo callbacks are placeholders. Stack on phones. | MIT |
| [Vercel Tabs · Yadwinder Singh](https://21st.dev/@yadwinder/components/vercel-tabs) | Lead detail: Overview / Trip / Quotes / Payments / Activity; Board / List switch. | Keep labels visible on phones, add full tab keyboard semantics if absent, retain URL and unsaved form state. | MIT |
| [Credenza · redpangilinan](https://21st.dev/@redpangilinan/components/credenza) | Add Lead, Follow-up, payment dialogs: dialog on desktop, bottom drawer on phones. | Uses shadcn dialog/drawer and Vaul. Integrate the existing focus trap, dismissal and dirty-form rules; test mobile keyboard and long forms. | MIT |
| [Calendar / date picker · Origin UI](https://21st.dev/@originui/components/calendar/date-picker) | Travel dates, booking filters, quotation forms. | React Day Picker and date-fns are already installed. Adapt popover/button wrappers and check API versions. Preserve date-only values, min/max rules and trip-night calculations. | MIT |
| [Empty State · Serafim](https://21st.dev/@serafimcloud/components/empty-state) | No leads, no results, no quotations, no documents. | Show a useful contextual action: clear filters, add a lead or create a quote. Loading, genuine empty and request failure need different messages. | MIT |
| [Save Changes Toast · Yadwinder Singh](https://21st.dev/@yadwinder/components/toast-save) | Lead profile, trip edits, employee/settings forms: visible Save / Discard state. | Only show for dirty forms. Integrate real pending/error/success state; do not report success before the request completes. Keep clear of mobile navigation and keyboards. | MIT |
| [Stats Bento · UI Layouts](https://21st.dev/@uilayout.contact/components/stats-bento) | Dashboard: one important summary with smaller supporting metrics. | Borrow hierarchy and composition, reduce the marketing-scale whitespace. Use real CRM metrics and existing cards rather than copying a full marketing section. Stack naturally on phones. | MIT |
| [Statistics Card 2 · ReUI](https://21st.dev/@sean0205/components/statistics-card-2) | Collections, outstanding amount, conversion, enquiries. | ReUI has its own card/button/menu variants. Map to TTE primitives and INR formatting. Reduce the full-card color saturation; show comparisons only when actual historical data exists. | MIT |
| [Line Charts 4 · ReUI](https://21st.dev/@sean0205/components/line-charts-4) | Enquiry and collection trends on Dashboard. | Uses Recharts, already installed. Adapt chart wrapper/theme and version differences. Make legends/tooltips usable on touch; include text summaries and avoid cramped date ticks. | MIT |
| [Activity Timeline · 7Ovr](https://21st.dev/@olewandowski1/components/timeline-3) | Calls, owner changes, notes, quotations and payment events in Lead Details. | Replace sample developer activity with real CRM events. Group by day; include actor and exact time. Do not invent events or imply a new audit trail exists. | MIT-0 |
| [Texture Button · cult/ui](https://21st.dev/@cult-ui/components/texture-button) | Refine primary New Lead / Save / Generate Quote actions with subtle depth. | Reuse current Button API, loading states, 44px touch targets and focus styles. Keep neutral secondary controls; use less texture than the demo. | MIT |
| [Sliding Number · Motion Primitives](https://21st.dev/@ibelick/components/sliding-number/slider) | Small metric transitions after an actual filter/data change. | Listing dependencies include motion and react-use-measure. Existing app uses framer-motion; assess adaptation before adding another package. Respect reduced motion; keep currency values and screen-reader announcements stable. | MIT |
| [Async Select · rds_agi](https://21st.dev/@rudrodip/components/async-select) | Search customers, agents, suppliers or hotels in long lists. | Visible demo imports next/image; replace with a normal image or existing avatar for Vite. Debounce/cancel real searches; handle loading/no results/errors and keyboard focus. | MIT |
| [File Upload · HextaUI](https://21st.dev/@preetsuthar17/components/file-upload) | Lead attachments, vouchers, receipts and supporting documents. | Drag/drop plus a normal file button. Connect real upload, validation, progress and retry. Never fake progress or completion; keep the storage and access rules already in use. | MIT |
| [Table · Kibo UI](https://21st.dev/@haydenbleasel/components/data-table) | Possible second-stage foundation for consistent customer/payment tables. | Visible demo uses TanStack Table and next/image. It is a larger change than a toolbar: map real columns, selection and exports; replace Next-specific example code. Keep a dedicated phone card view. | MIT |
| [Command Menu · Uai](https://21st.dev/@victor-teles/components/command-menu) | Refine existing global search with grouped Leads / Customers / Actions. | Listing describes keyboard navigation and reduced-motion support; verify against full source. Keep a visible search entry on phones and enforce existing role checks. The live iframe was blank during inspection, so interaction remains unverified. | MIT |

## Visual references

Screenshots are actual public catalog demos with sample content, not screenshots of a changed CRM. The six desktop references and two phone captures are in `assets/` and the visual collection.

- Stats Bento: strong summary hierarchy, adapted to a smaller CRM footprint.
- Toolbar: search, columns, export and contextual selection actions together.
- Tabs: low-height navigation within a page, avoiding another large header band.
- Texture Button: restrained physical depth for important actions.
- Empty State: a clear message and one next action.
- Activity Timeline: a readable history rather than disconnected cards.

## Mobile spot checks

Chrome emulation at **390 × 690**:

- Toolbar demo: document scroll width 390px; no page-level horizontal overflow in the default state.
- Credenza demo: Open Modal displayed a named dialog as a bottom drawer; settled bounds were x=0, width=390, top=444, bottom=690. Close was activated. Focus return was not independently verified.
- These are small catalog demos. Long lead forms, virtual keyboards, errors, dark/ocean themes, 320px screens and physical iOS/Android behavior still need testing in the CRM.

## Components held back

These five additional inspected listings are recorded in `research.json` but are not in the import shortlist because their pages showed no explicit license: Capsule Tabs, Dashboard With Collapsible Sidebar, shadcn Empty, Cnippet Promise Toast and Ephraim Duncan File Upload. This does not establish that they are paid or unusable; it means source licensing needs checking first.

Large shaders, continuously moving backgrounds, magnetic cursors, heavy glass layers and full marketing hero layouts would add visual noise to routine lead and finance work. A subtle accent can work in an empty state or login screen; keep operational screens readable, fast and stable.

## Integration order and acceptance

1. Shared polish: toolbar, tabs, form labels, validation, date controls, empty/error/loading states and restrained button treatment.
2. Workflow polish: mobile dialogs, unsaved changes, activity history and document upload states.
3. Dashboard polish: real metric hierarchy and consistent Recharts presentation, then optional number transitions.
4. Only consider replacing table infrastructure if existing tables cannot support the required interactions cleanly.

Keep TTE's existing typography, blue accent, 12px card/8px control radii, roles, calculations, API contracts and database behavior. Prefer adapting visuals into existing primitives over installing many independent design systems. Do not replace react-hot-toast solely to copy a notification style.

Before merging any future implementation: verify widths 320/390/768/1024/1440, keyboard navigation and visible focus, long names and INR values, zoom, all existing themes, reduced motion, real async success/failure states and mobile keyboard behavior. Keep essential actions available without hover. The current research does not certify these candidates against all those requirements.
