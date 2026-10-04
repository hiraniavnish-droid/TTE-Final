# CRM loading and lead performance

Lead requests use ordered 100-row ranges. The first batch renders immediately, while the complete index continues loading for reporting, filters and exports. Supporting tables load independently in 500-row ranges, avoiding the implicit Supabase row cap. Errors show a Retry action; exports remain disabled until loading finishes. Dashboard figures stay in a loading state if data is incomplete.

Kanban mounts 30 cards per stage initially; Overview mounts 36 per group. An IntersectionObserver extends the list as the scroll boundary approaches, with a manual Show more action as fallback. Only the active desktop/mobile layout mounts. Bookings display 50 rows initially with a Show more action.

Expired JWTs return to login; explicit database 401 responses clear the session. Database requests time out after 25 seconds. HTML revalidates between deployments, failed lazy chunks trigger one automatic reload per minute, and a real error boundary provides a recovery button for render failures.

## Browser regression check

Use an isolated checkout with test-only `.env.local` values:

```text
VITE_SUPABASE_URL=https://performance-test.supabase.co
VITE_SUPABASE_ANON_KEY=test-anon-key
```

Build and serve with `npm run build` and `npm run preview -- --port 3099`, then run `node scripts/verify-leads-performance.mjs`. Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is not available by package name; `CRM_TEST_BASE` overrides the local test server. Do not run against customer production data. The test intercepts Supabase and payment requests and supplies 2,407 synthetic leads, including incomplete nested trip/contact objects. It checks independent first paint, all pages beyond the 1,000-row cap, bounded desktop/Overview/mobile DOM, scroll loading, old direct links, runtime errors, retries and expired-session recovery. Optional `CRM_TEST_SCREENSHOTS` names an existing output directory.

Validation: production build passes and the browser regression suite passes. The repository-wide TypeScript check still has pre-existing errors in quotation/builder files, Vite env declarations, script union types and Deno functions; none were expanded by this change.
