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

## Admin-created employee accounts

Admins can create staff accounts directly from the **Employees** page (full
name, email, password — the employee signs in immediately with those
credentials). This calls a Supabase Edge Function (`create-employee`) that
holds the service-role key server-side; it is not exposed to the browser.

Deploy it once via the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy create-employee
```

No extra secrets need to be set — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are automatically available to every Edge
Function in your project.

## Updating an existing Supabase project

If your project was created before the Performance/Suppliers-purchase-history
features were added, run this once in the SQL editor to bring an existing
database up to date (safe to re-run, it only adds what's missing):

```sql
alter table daily_reports add column if not exists admin_feedback text;

create table if not exists supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  purchase_date date not null default current_date,
  item_description text not null,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table supplier_purchases enable row level security;

create policy "supplier_purchases_select" on supplier_purchases for select
  using (auth.uid() is not null);
create policy "supplier_purchases_insert" on supplier_purchases for insert
  with check (is_admin());
create policy "supplier_purchases_update" on supplier_purchases for update
  using (is_admin());
create policy "supplier_purchases_delete" on supplier_purchases for delete
  using (is_admin());
```

## Features

- **Daily Reports** — each employee logs a daily summary + quotation count;
  employees can edit past entries, admins can leave feedback per report and
  filter history by employee.
- **Quotations** — track customer, item, amount (SAR), status, rejection reason;
  full edit/delete; dashboard flags quotations pending 3+ days with no reply.
- **Cash Flow** — inflow/outflow, daily expenses, credit given/taken with
  settlement tracking, inline edit/delete, date-range filter, and totals by
  category (admin only).
- **Suppliers** — directory of what each supplier sells, contact info,
  location; admins can edit/delete suppliers and log a purchase history per
  supplier (date, item, amount, notes).
- **Dashboard** — admin sees progress across all employees; employees see their
  own stats and follow-up alerts.
- **Performance** (admin only) — leaderboard of conversion rate, average
  follow-up speed, overdue follow-ups, daily-report consistency, and revenue
  contribution per employee, with a chart and CSV export.

## Deploying

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages,
etc.) and set the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as
environment variables on the host.
