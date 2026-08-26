# Multi-Tenant Restaurant POS Web App (Sprint 1 Foundation)

A multi-tenant cloud restaurant point-of-sale foundation built with React, Vite, Vanilla CSS, and Supabase (Auth + PostgreSQL with Row Level Security).

---

## 🌟 Sprint 1 Deliverables & Architecture

- **Supabase Database Schema**:
  - `organizations`: Multi-tenant organization records (`id`, `name`, `owner_name`, `phone`, `address`, `logo_url`, `tax_percent`, `kitchen_invoice_enabled`, `status`, `created_at`).
  - `profiles`: User profile linking `auth.users` to `organizations` with roles (`owner`, `manager`, `cashier`, `waiter`).
  - `public.get_user_organization_id()`: `SECURITY DEFINER` function ensuring zero-recursion in RLS policies.
  - Strict Row Level Security (RLS) isolating all data between tenant organizations.
  - Auth trigger (`handle_new_user_signup`) and fallback RPC (`register_restaurant`) for atomic tenant onboarding.
- **Auth & Onboarding Flow**:
  - Public Sign Up page with restaurant details, owner name, email, phone, and password.
  - Login page with email and password.
  - Gated Status Controller:
    - `status = 0`: Full-screen **Account Pending Activation** payment gate with message: *"Your account is not yet active. Please contact support to complete your subscription payment."* (Blocks dashboard access).
    - `status = 10`: Grants access to the placeholder **/dashboard** displaying *"Welcome, {restaurant name}"*.
  - Full logout support across all views.

---

## 🚀 Quick Setup Guide

### 1. Configure Supabase Backend
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase project dashboard.
3. Open [`supabase/schema.sql`](./supabase/schema.sql), paste the entire script into the SQL Editor, and click **Run**.
4. In your Supabase dashboard, go to **Project Settings > API** and copy:
   - Project URL (`https://<project-ref>.supabase.co`)
   - `anon` `public` key

### 2. Configure Environment Variables
Create or edit `.env` in the project root:
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Locally
```bash
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🧪 Sprint 1 Test Checklist

| # | Test Action | Expected Result |
|---|---|---|
| 1 | **Sign up a new account** (e.g. *"Bella Napoli"*, owner *"Mario Rossi"*) | User is registered, `organizations` is inserted with `status = 0`, profile is created with role `owner`, and user is blocked by the full-screen "Account Pending Activation" gate. |
| 2 | **Update org status to 10 in Supabase**:<br>`UPDATE public.organizations SET status = 10 WHERE name = 'Bella Napoli';` | Click **Check Status** or log out and log back in → User immediately lands on the placeholder dashboard with *"Welcome, Bella Napoli"*. |
| 3 | **Multi-tenant isolation test**:<br>Sign up a second tenant (e.g. *"Tokyo Ramen"*). | Query Supabase as each authenticated user. Due to RLS, each user can only read and write data belonging to their own `organization_id`. |
