# Manual payment corrections

Payment Status exposes Edit Payment for manually recorded receipts. The existing entry can be corrected: amount, received date, method, entry reference, notes, customer name, phone and email. The widget replaces the saved record and recalculates its totals without adding a second payment. Cancel leaves the entry unchanged. Gateway-owned payments are excluded from this editor.

The API uses `PATCH /api/razorpay-link` with `action: edit_manual`, payment id, fields, and an `expected` snapshot of the editable fields. It validates a signed, unexpired staff session against the current user/session version, enforces amount/date/method limits, and compares the snapshot with the current row. A conditional row update detects concurrent corrections and returns 409 rather than overwriting them. Lead linkage, source, status, system reference, creation date and original creator are preserved. The received timestamp is retained if the date is unchanged.

Successful corrections append a COMMENT activity record with verified editor, payment id and before/after values. If logging fails after saving, the response returns the saved payment with a warning so the UI does not present the successful write as a failed payment save.

Existing document records are not rewritten. The editor shows a reminder when a pending or issued receipt/invoice is attached, so staff can review those documents after changing a payment.

Validation: `node scripts/verify-manual-payment-edit.mjs` tests authentication, revoked/expired sessions, validation, conflicts, metadata/linkage preservation, gateway protection, before/after logging and logging failure. Browser checks with synthetic payments verify prefilled fields, document reminder, Save Changes, cancellation, conflict feedback and totals changing from ₹5,00,000 to ₹4,50,000 while retaining exactly two entries. The production build passes; the conditional filters were also checked against production using read-only requests. No customer payment values were changed during verification.
