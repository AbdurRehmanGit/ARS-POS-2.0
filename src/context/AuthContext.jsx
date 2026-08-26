import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

const SANDBOX_STORAGE_KEY = 'restaurant_pos_sandbox_data';

// All supported page keys for Sprint 2
export const ALL_PAGE_KEYS = [
  'dashboard',
  'pos',
  'menu_management',
  'inventory',
  'order_history',
  'reports',
  'staff_management',
  'settings'
];

const getInitialSandboxData = () => {
  try {
    const data = localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading sandbox data', e);
  }
  return {
    users: [],
    organizations: [],
    profiles: [],
    rolePermissions: [],
    currentUserId: null,
  };
};

const saveSandboxData = (data) => {
  try {
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving sandbox data', e);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSandboxMode, setIsSandboxMode] = useState(!isSupabaseConfigured());

  // Fetch role permissions for tenant
  const fetchTenantPermissions = useCallback(async (orgId) => {
    if (!supabase || !orgId) return [];
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('organization_id', orgId);
      
      if (error) {
        console.warn('Could not load role_permissions:', error.message);
        return [];
      }
      setPermissions(data || []);
      return data || [];
    } catch (err) {
      console.warn('Error in fetchTenantPermissions:', err);
      return [];
    }
  }, []);

  // Fetch tenant profile, organization & permissions
  const fetchTenantData = useCallback(async (userId) => {
    if (!supabase || !userId) return null;

    try {
      let { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!userProfile) {
        // Wait slightly and retry in case trigger is executing
        await new Promise((r) => setTimeout(r, 600));
        const retry = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        userProfile = retry.data;
      }

      if (!userProfile) {
        setProfile(null);
        setOrganization(null);
        setPermissions([]);
        return null;
      }

      setProfile(userProfile);

      // Fetch organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .maybeSingle();

      if (orgError) throw orgError;

      setOrganization(orgData);

      // Fetch permissions
      if (orgData?.id) {
        await fetchTenantPermissions(orgData.id);
      }

      return { profile: userProfile, organization: orgData };
    } catch (err) {
      console.error('Failed to load tenant data:', err);
      setError(err.message || 'Failed to load organization data.');
      return null;
    }
  }, [fetchTenantPermissions]);

  // Initialize Auth State
  useEffect(() => {
    if (isSupabaseConfigured() && supabase) {
      setIsSandboxMode(false);
      
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchTenantData(session.user.id);
        }
        setLoading(false);
      }).catch((err) => {
        console.error('Supabase session init error:', err);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            await fetchTenantData(currentSession.user.id);
          } else {
            setProfile(null);
            setOrganization(null);
            setPermissions([]);
          }
          setLoading(false);
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    } else {
      // Sandbox fallback initialization
      const sandbox = getInitialSandboxData();
      if (sandbox.currentUserId) {
        const foundUser = sandbox.users.find((u) => u.id === sandbox.currentUserId);
        const foundProfile = sandbox.profiles.find((p) => p.id === sandbox.currentUserId);
        const foundOrg = sandbox.organizations.find((o) => o.id === foundProfile?.organization_id);

        if (foundUser && foundProfile && foundOrg) {
          setUser(foundUser);
          setSession({ user: foundUser });
          setProfile(foundProfile);
          setOrganization(foundOrg);
          setPermissions(sandbox.rolePermissions || []);
        }
      }
      setLoading(false);
    }
  }, [fetchTenantData]);

  // Sign Up Handler
  const signUp = async ({ restaurantName, ownerName, email, phone, password }) => {
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              restaurant_name: restaurantName,
              owner_name: ownerName,
              phone: phone,
              full_name: ownerName,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data?.user) {
          setUser(data.user);
          setSession(data.session);
          await new Promise((r) => setTimeout(r, 600));
          await fetchTenantData(data.user.id);
        }

        setLoading(false);
        return { success: true, user: data.user };
      } else {
        const sandbox = getInitialSandboxData();
        if (sandbox.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('User already registered in sandbox mode.');
        }

        const newUserId = 'usr_' + Math.random().toString(36).substring(2, 9);
        const newOrgId = 'org_' + Math.random().toString(36).substring(2, 9);

        const newUser = { id: newUserId, email, created_at: new Date().toISOString() };
        const newOrg = {
          id: newOrgId,
          name: restaurantName,
          owner_name: ownerName,
          phone: phone || null,
          address: null,
          logo_url: null,
          tax_percent: 0,
          kitchen_invoice_enabled: false,
          currency: 'PKR',
          status: 0,
          created_at: new Date().toISOString(),
        };
        const newProfile = {
          id: newUserId,
          organization_id: newOrgId,
          full_name: ownerName,
          role: 'owner',
          email,
          phone: phone || null,
          created_at: new Date().toISOString(),
        };

        sandbox.users.push(newUser);
        sandbox.organizations.push(newOrg);
        sandbox.profiles.push(newProfile);
        sandbox.currentUserId = newUserId;
        saveSandboxData(sandbox);

        setUser(newUser);
        setSession({ user: newUser });
        setProfile(newProfile);
        setOrganization(newOrg);
        setPermissions(sandbox.rolePermissions || []);
        setLoading(false);

        return { success: true, user: newUser };
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  // Sign In Handler
  const signIn = async ({ email, password }) => {
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setUser(data.user);
        setSession(data.session);
        await fetchTenantData(data.user.id);
        setLoading(false);
        return { success: true, user: data.user };
      } else {
        const sandbox = getInitialSandboxData();
        const foundUser = sandbox.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

        if (!foundUser) {
          throw new Error('Invalid login credentials in sandbox mode.');
        }

        const foundProfile = sandbox.profiles.find((p) => p.id === foundUser.id);
        const foundOrg = sandbox.organizations.find((o) => o.id === foundProfile?.organization_id);

        sandbox.currentUserId = foundUser.id;
        saveSandboxData(sandbox);

        setUser(foundUser);
        setSession({ user: foundUser });
        setProfile(foundProfile);
        setOrganization(foundOrg);
        setPermissions(sandbox.rolePermissions || []);
        setLoading(false);

        return { success: true, user: foundUser };
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  // Sign Out Handler
  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut();
      } else {
        const sandbox = getInitialSandboxData();
        sandbox.currentUserId = null;
        saveSandboxData(sandbox);
      }
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setOrganization(null);
      setPermissions([]);
      setError(null);
      setLoading(false);
    }
  };

  // Refresh Tenant & Permissions
  const refreshTenantStatus = async () => {
    if (!user) return;
    setLoading(true);
    if (isSupabaseConfigured() && supabase) {
      await fetchTenantData(user.id);
    } else {
      const sandbox = getInitialSandboxData();
      const foundProfile = sandbox.profiles.find((p) => p.id === user.id);
      const foundOrg = sandbox.organizations.find((o) => o.id === foundProfile?.organization_id);
      setProfile(foundProfile || null);
      setOrganization(foundOrg || null);
      setPermissions(sandbox.rolePermissions || []);
    }
    setLoading(false);
  };

  // Lightweight re-fetch of organization row only (used by Settings after profile save)
  const refreshOrganization = useCallback(async () => {
    if (!organization?.id) return;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: err } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', organization.id)
          .maybeSingle();
        if (!err && data) setOrganization(data);
      } else {
        const sandbox = getInitialSandboxData();
        const foundOrg = sandbox.organizations.find((o) => o.id === organization.id);
        if (foundOrg) setOrganization({ ...foundOrg });
      }
    } catch (err) {
      console.warn('refreshOrganization error:', err);
    }
  }, [organization?.id]);

  // Permission Check Function
  const isPageAllowed = useCallback((pageKey, specificRole = null) => {
    const roleToTest = specificRole || profile?.role || 'owner';

    // 1. Owner always has access to all pages regardless of role_permissions
    if (roleToTest === 'owner') {
      return true;
    }

    // 2. Look for matching permission row
    const match = permissions.find(
      (p) => p.role === roleToTest && p.page_key === pageKey
    );

    if (match !== undefined) {
      return Boolean(match.allowed);
    }

    // 3. Safe Defaults if no row exists yet:
    // Dashboard and POS default to allowed; all other pages default to NOT allowed
    if (pageKey === 'dashboard' || pageKey === 'pos') {
      return true;
    }

    return false;
  }, [profile, permissions]);

  // Set / Update Role Permission
  const setRolePermission = async (role, pageKey, allowed) => {
    if (!organization?.id) return;

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('role_permissions')
        .upsert(
          {
            organization_id: organization.id,
            role,
            page_key: pageKey,
            allowed,
          },
          { onConflict: 'organization_id,role,page_key' }
        );

      if (error) {
        console.error('Error saving role permission:', error);
        throw error;
      }
      await fetchTenantPermissions(organization.id);
    } else {
      const sandbox = getInitialSandboxData();
      if (!sandbox.rolePermissions) sandbox.rolePermissions = [];
      const idx = sandbox.rolePermissions.findIndex(
        (p) => p.organization_id === organization.id && p.role === role && p.page_key === pageKey
      );
      if (idx !== -1) {
        sandbox.rolePermissions[idx].allowed = allowed;
      } else {
        sandbox.rolePermissions.push({
          id: 'perm_' + Math.random().toString(36).substring(2, 9),
          organization_id: organization.id,
          role,
          page_key: pageKey,
          allowed,
        });
      }
      saveSandboxData(sandbox);
      setPermissions([...sandbox.rolePermissions]);
    }
  };

  // Helper for fast live testing: simulate changing the active user's role in the UI
  const setSimulatedRole = (newRole) => {
    if (!profile) return;
    setProfile((prev) => ({ ...prev, role: newRole }));
  };

  // Sandbox helper to update status to 10
  const updateSandboxOrgStatus = (newStatus) => {
    if (!organization) return;
    const sandbox = getInitialSandboxData();
    const orgIndex = sandbox.organizations.findIndex((o) => o.id === organization.id);
    if (orgIndex !== -1) {
      sandbox.organizations[orgIndex].status = newStatus;
      saveSandboxData(sandbox);
      setOrganization({ ...sandbox.organizations[orgIndex] });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        permissions,
        loading,
        error,
        isSandboxMode,
        signUp,
        signIn,
        signOut,
        refreshTenantStatus,
        refreshOrganization,
        isPageAllowed,
        setRolePermission,
        setSimulatedRole,
        updateSandboxOrgStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
