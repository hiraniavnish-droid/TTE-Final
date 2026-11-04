# TTE CRM design context

The user requested a cohesive modern interface, reliable phone layouts and recovery from stale browser files. Use the shared slate/blue tokens in `styles/crm.css`, Plus Jakarta Sans, 12px cards, 8px controls and a compact information hierarchy. The existing TTE identity and light/dark/ocean choices remain.

Desktop uses grouped sidebar navigation and one clear new-lead action. Below 1024px use a compact header, safe-area-aware mobile navigation and an accessible More dialog containing every section. Put search before extra lead filters. Keep a single page scroll on phones and contain deliberate horizontal scrolling within boards, tables and tabs.

Reuse Button, Card, Modal, UserAvatar and the existing CRM contexts. Modal content must scroll within the viewport, trap keyboard focus, close on Escape and restore focus. Keep 44px phone controls and 16px form text. Avoid decorative glows, bouncing cards, mixed heading fonts and animated route containers that change the coordinate system of fixed dialogs.

Business calculations, staff permissions, integration workers and quotation engines stay intact. See `docs/ui-refresh/REVIEW.md` for verification and baseline limitations.
