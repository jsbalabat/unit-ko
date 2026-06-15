// Identity attached to the request by the auth guards. `landlord` comes from a
// verified Supabase JWT; `tenant` from a verified HMAC session cookie. Handlers
// read these via the @CurrentLandlord() / @CurrentTenant() param decorators —
// the id always originates from a verified token, never from the request body.
declare global {
  namespace Express {
    interface Request {
      landlord?: { id: string; email?: string };
      tenant?: { id: string };
    }
  }
}

export {};
