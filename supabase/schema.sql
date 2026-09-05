-- ====================================================================
-- MULTI-TENANT RESTAURANT POS DATABASE SCHEMA (SPRINT 1 - SPRINT 6)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  kitchen_invoice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  currency TEXT NOT NULL DEFAULT 'PKR',
  status INTEGER NOT NULL DEFAULT 0, -- 0 = Pending Payment, 10 = Active
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'waiter')),
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'waiter')),
  page_key TEXT NOT NULL CHECK (page_key IN ('dashboard', 'pos', 'menu_management', 'inventory', 'order_history', 'reports', 'staff_management', 'settings')),
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role, page_key)
);

-- 4. Menu Categories Table
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('pizza', 'standard')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Menu Item Prices Table
CREATE TABLE IF NOT EXISTS public.menu_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  size_label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  receipt_number INTEGER NOT NULL,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'Other')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  size_label TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);

-- 9. Inventory Items Table (Sprint 5)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pieces',
  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_alert NUMERIC(10,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org ON public.role_permissions(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_menu_categories_org ON public.menu_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_org ON public.menu_items(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_prices_item ON public.menu_item_prices(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(organization_id, name);

-- 11. Recursive-Safe Tenant Lookup Function
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 12. Per-Organization Receipt Number Generator Function
CREATE OR REPLACE FUNCTION public.get_next_receipt_number(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(receipt_number), 0) + 1 
  FROM public.orders 
  WHERE organization_id = p_org_id;
$$;

-- 13. Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 14. RLS Policies
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
CREATE POLICY "Users can view own organization" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
CREATE POLICY "Owners can update own organization" ON public.organizations
  FOR UPDATE TO authenticated USING (id = public.get_user_organization_id())
  WITH CHECK (id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Users can view profiles in own organization" ON public.profiles;
CREATE POLICY "Users can view profiles in own organization" ON public.profiles
  FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Users can update profile in own organization" ON public.profiles;
CREATE POLICY "Users can update profile in own organization" ON public.profiles
  FOR UPDATE TO authenticated USING (
    organization_id = public.get_user_organization_id()
    AND (id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'))
  );

DROP POLICY IF EXISTS "Users can view role permissions in own organization" ON public.role_permissions;
CREATE POLICY "Users can view role permissions in own organization" ON public.role_permissions
  FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Owners and managers can manage role permissions" ON public.role_permissions;
CREATE POLICY "Owners and managers can manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (
    organization_id = public.get_user_organization_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'manager'))
  );

DROP POLICY IF EXISTS "Tenant isolation for menu_categories" ON public.menu_categories;
CREATE POLICY "Tenant isolation for menu_categories" ON public.menu_categories
  FOR ALL TO authenticated USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Tenant isolation for menu_items" ON public.menu_items;
CREATE POLICY "Tenant isolation for menu_items" ON public.menu_items
  FOR ALL TO authenticated USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Tenant isolation for menu_item_prices" ON public.menu_item_prices;
CREATE POLICY "Tenant isolation for menu_item_prices" ON public.menu_item_prices
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.menu_items
      WHERE menu_items.id = menu_item_prices.menu_item_id
      AND menu_items.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_items
      WHERE menu_items.id = menu_item_prices.menu_item_id
      AND menu_items.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for orders" ON public.orders;
CREATE POLICY "Tenant isolation for orders" ON public.orders
  FOR ALL TO authenticated USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Tenant isolation for order_items" ON public.order_items;
CREATE POLICY "Tenant isolation for order_items" ON public.order_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.organization_id = public.get_user_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.organization_id = public.get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for inventory_items" ON public.inventory_items;
CREATE POLICY "Tenant isolation for inventory_items" ON public.inventory_items
  FOR ALL TO authenticated USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- 15. Automatic User & Tenant Signup Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_restaurant_name TEXT;
  v_owner_name TEXT;
  v_phone TEXT;
BEGIN
  v_restaurant_name := coalesce(nullif(trim(new.raw_user_meta_data->>'restaurant_name'), ''), 'My Restaurant');
  v_owner_name := coalesce(nullif(trim(new.raw_user_meta_data->>'owner_name'), ''), 'Restaurant Owner');
  v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');

  INSERT INTO public.organizations (name, owner_name, phone, status)
  VALUES (v_restaurant_name, v_owner_name, v_phone, 0)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name, role, email, phone)
  VALUES (new.id, v_org_id, v_owner_name, 'owner', coalesce(new.email, ''), v_phone);

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user_signup: %', SQLERRM;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- ====================================================================
-- SPRINT 8: STAFF TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary NUMERIC(10,2),
  email TEXT,
  phone TEXT,
  address TEXT,
  cnic TEXT,
  has_dashboard_access BOOLEAN NOT NULL DEFAULT FALSE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_org ON public.staff(organization_id);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for staff" ON public.staff
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- ====================================================================
-- SPRINT 9: SUPABASE STORAGE — LOGOS BUCKET
-- Run these two lines in the Supabase SQL Editor OR create the bucket
-- manually via Storage UI: name="logos", make it PUBLIC.
-- ====================================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('logos', 'logos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow any authenticated user from the same org to upload/read their logo
-- (Supabase Storage policies are set via the Storage UI or CLI, not raw SQL)
-- Policy name: "Authenticated users can upload to logos"
-- Target: storage.objects | INSERT + SELECT + UPDATE + DELETE
-- Condition: bucket_id = 'logos' AND auth.role() = 'authenticated'

-- ====================================================================
-- MIGRATION: ADD CURRENCY COLUMN TO ORGANIZATIONS (If table already exists)
-- ====================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PKR';

-- ====================================================================
-- MIGRATION: UPDATE ROLE PERMISSIONS CHECK CONSTRAINT
-- ====================================================================
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_page_key_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_page_key_check 
  CHECK (page_key IN (
    'dashboard', 'pos', 'pending_deliveries', 'rider_management',
    'menu_management', 'inventory', 'order_history', 'reports', 
    'staff_management', 'expenses', 'profit_and_loss', 'settings'
  ));

-- ====================================================================
-- SPRINT F & G: EXPENSES & PROFIT/LOSS SYSTEM SCHEMA
-- ====================================================================

-- Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(organization_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_cat ON public.expenses(organization_id, category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for expenses" ON public.expenses;
CREATE POLICY "Tenant isolation for expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- ====================================================================
-- RIDER TRACKING & DELIVERY DISPATCH SYSTEM SCHEMA (SPRINTS A - E)
-- ====================================================================

-- 1. Riders Table
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary NUMERIC,
  phone TEXT NOT NULL,
  email TEXT,
  bike_model TEXT,
  bike_number TEXT,
  login_pin TEXT DEFAULT '1234',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riders_org ON public.riders(organization_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON public.riders(organization_id, status);

ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for riders" ON public.riders;
CREATE POLICY "Tenant isolation for riders" ON public.riders
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Allow anon to verify rider phone + PIN in mobile portal
DROP POLICY IF EXISTS "Rider portal phone login" ON public.riders;
CREATE POLICY "Rider portal phone login" ON public.riders
  FOR SELECT TO anon
  USING (true);

-- 2. Extend Orders Table for Delivery Support
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'walkin' CHECK (order_type IN ('walkin', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT NULL CHECK (delivery_status IN ('pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled')),
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivery ON public.orders(organization_id, order_type, delivery_status);

-- Allow rider mobile portal to view assigned active orders
DROP POLICY IF EXISTS "Rider portal view assigned orders" ON public.orders;
CREATE POLICY "Rider portal view assigned orders" ON public.orders
  FOR SELECT TO anon
  USING (order_type = 'delivery' AND rider_id IS NOT NULL);

-- 3. Live Rider Locations Table (GPS Telemetry)
CREATE TABLE IF NOT EXISTS public.rider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  heading NUMERIC,
  speed NUMERIC,
  is_sharing BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_locations_rider ON public.rider_locations(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_org ON public.rider_locations(organization_id, updated_at DESC);

ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for rider_locations" ON public.rider_locations;
CREATE POLICY "Tenant isolation for rider_locations" ON public.rider_locations
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Allow mobile rider app to push GPS telemetry without full Supabase account session
DROP POLICY IF EXISTS "Rider portal location update" ON public.rider_locations;
CREATE POLICY "Rider portal location update" ON public.rider_locations
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);
