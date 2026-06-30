# Mechno Skill — Work Tracker

Internal staff app for tracking employee daily reports, quotations & follow-ups,
cash flow, and supplier directory. Built with React + Vite + Supabase.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open the **SQL Editor** and run the contents of `supabase/schema.sql` (creates
   tables, RLS policies, and an auto-profile trigger).
3. In **Project Settings → API**, copy the **Project URL** and **anon public key**.

## 2. Configure the app

Copy `.env.example` to `.env` and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. First admin user

New accounts created via "Create an account" on the login screen default to the
`employee` role. To make the first admin, run this once in the Supabase SQL editor
after that user signs up:

```sql
update profiles set role = 'admin' where id = (
  select id from auth.users where email = 'you@example.com'
);
```

From then on, admins can promote/demote other staff from the **Employees** page
in the app.

## Features

- **Daily Reports** — each employee logs a daily summary + quotation count.
- **Quotations** — track customer, item, amount (SAR), status, rejection reason;
  dashboard flags quotations pending 3+ days with no reply.
- **Cash Flow** — inflow/outflow, daily expenses, credit given/taken with
  settlement tracking (admin only).
- **Suppliers** — directory of what each supplier sells, contact info, location.
- **Dashboard** — admin sees progress across all employees; employees see their
  own stats and follow-up alerts.

## Deploying

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages,
etc.) and set the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as
environment variables on the host.
