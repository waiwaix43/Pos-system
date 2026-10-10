# Deploy on Vercel

The root `vercel.json` configures a Vercel project with two services: the Next.js frontend at `/` and the Express API at `/api/*`.

1. Import this repository into Vercel and leave the project Root Directory at the repository root.
2. Add `SUPABASE_URL`, `SUPABASE_KEY`, and `JWT_SECRET` for the backend service. Vercel does not generate `JWT_SECRET`, so use a long random secret.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend service.
4. Add `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`, and `PAYMENT_PUBLIC_KEY` to the backend service only when payment credentials are not configured in the database.
5. Deploy. Frontend API requests use the same-origin `/api/*` rewrite; do not set `NEXT_PUBLIC_API_URL` for this deployment.

`NEXT_PUBLIC_*` values are included in browser code. Never put a Supabase `service_role` key or payment secret in a `NEXT_PUBLIC_*` variable.

The backend's in-process midnight notification cleanup uses `node-cron`. Vercel serverless instances are not continuously running, so that cleanup is not guaranteed to execute on schedule; use a Vercel Cron-triggered endpoint or an always-on worker if nightly cleanup is required.

## Check Supabase

The app needs its tables, policies, and Storage buckets configured in the selected Supabase project. Keep the existing project data: deploying the app does not create or remove database tables. Configure payment tables only if the payment feature is used.

Anyone you share the Vercel URL with will reach the same backend and Supabase data. Use test data until access controls and database policies are verified.

For local development, copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`, then replace the example values with your own settings.
