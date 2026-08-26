-- ====================================================================
-- SPRINT 2 TEST CHECKLIST & VERIFICATION QUERIES
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Check all role permissions for your organization
-- --------------------------------------------------------------------
SELECT 
  rp.id,
  o.name as restaurant_name,
  rp.role,
  rp.page_key,
  rp.allowed,
  rp.created_at
FROM public.role_permissions rp
JOIN public.organizations o ON o.id = rp.organization_id
ORDER BY rp.role, rp.page_key;

-- --------------------------------------------------------------------
-- 2. SPRINT 2 CHECKLIST TEST: Deny Cashier access to Inventory
-- Insert or update a permission row denying 'cashier' access to 'inventory'
-- --------------------------------------------------------------------
INSERT INTO public.role_permissions (organization_id, role, page_key, allowed)
SELECT id, 'cashier', 'inventory', false
FROM public.organizations
WHERE name = 'Bella Napoli' -- Or your restaurant name
ON CONFLICT (organization_id, role, page_key)
DO UPDATE SET allowed = false;

-- Verify it was set to false
SELECT role, page_key, allowed 
FROM public.role_permissions 
WHERE role = 'cashier';

-- --------------------------------------------------------------------
-- 3. Grant Waiter access to POS & Order History only
-- --------------------------------------------------------------------
INSERT INTO public.role_permissions (organization_id, role, page_key, allowed)
SELECT id, 'waiter', 'order_history', true
FROM public.organizations
WHERE name = 'Bella Napoli'
ON CONFLICT (organization_id, role, page_key)
DO UPDATE SET allowed = true;
