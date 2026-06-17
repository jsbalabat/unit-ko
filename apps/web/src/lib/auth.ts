import { supabase } from './supabase';
import { api } from './api-client';

/**
 * Auth utility functions for route protection
 */

export type UserRole = 'landlord' | 'tenant' | null;

/**
 * Check if a landlord is authenticated via Supabase Auth
 */
export async function checkLandlordAuth(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return false;
    }
    
    // Validate session is not expired
    if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a tenant is authenticated via server-backed tenant session cookie
 */
export async function checkTenantAuth(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    await api.tenantAuth.session();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current user role
 */
export async function getUserRole(): Promise<UserRole> {
  // Check landlord auth first
  const isLandlord = await checkLandlordAuth();
  if (isLandlord) return 'landlord';
  
  // Check tenant auth
  const isTenant = await checkTenantAuth();
  if (isTenant) return 'tenant';
  
  return null;
}

/**
 * Get landlord user ID
 */
export async function getLandlordUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get tenant ID from server-backed tenant session
 */
export async function getTenantId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const { tenantId } = await api.tenantAuth.session();
    return tenantId ?? null;
  } catch {
    return null;
  }
}

/**
 * Logout landlord
 */
export async function logoutLandlord(): Promise<void> {
  try {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error('Error logging out landlord:', error);
  }
}

/**
 * Logout tenant
 */
export async function logoutTenant(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await api.tenantAuth.logout();
  } catch {
    // No-op: caller handles redirect regardless.
  }
}

/**
 * Clear all auth data
 */
export async function clearAllAuth(): Promise<void> {
  await logoutLandlord();
  await logoutTenant();
}
