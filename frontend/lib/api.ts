// Central place for talking to the backend.
// Every request goes through here so the auth token only has to be wired up once.

export const API_BASE = "http://localhost:8080";

/**
 * Wraps the native fetch() and automatically attaches the "Golden Ticket"
 * (the JWT saved in localStorage after login) as a Bearer token.
 *
 * Usage is identical to fetch(), just swap the function name:
 *   authFetch("/api/resources")
 *   authFetch("/api/resources", { method: "POST", body: JSON.stringify(payload) })
 *
 * You can pass either a full URL or a path starting with "/" — paths are
 * automatically prefixed with API_BASE.
 */
export const authFetch = async (url: string, options: any = {}) => {
  const token = localStorage.getItem("authToken");

  // If there is no token, we shouldn't even try to hit the server
  // This prevents the "Network Error" for guests
  if (!token) {
    throw new Error("GUEST_MODE");
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });

  // Handle unauthorized/expired tokens
  if (response.status === 401) {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  }

  return response;
};

/**
 * Migrates any guest resources saved in localStorage to the authenticated
 * user's account on the backend. Called after login or registration.
 *
 * Flow:
 *   1. Read "guestResources" from localStorage
 *   2. POST each resource to the backend with the new token
 *   3. Clear "guestResources" from localStorage
 *
 * Returns the number of resources migrated.
 */
export const migrateGuestData = async (token: string): Promise<number> => {
  const guestData = localStorage.getItem("guestResources");
  if (!guestData) return 0;

  const guestResources = JSON.parse(guestData);
  if (!guestResources.length) return 0;

  let migrated = 0;

  for (const resource of guestResources) {
    try {
      const res = await fetch(`${API_BASE}/api/resources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: resource.title,
          url: resource.url,
          category: resource.category,
          difficulty: resource.difficulty,
        }),
      });
      if (res.ok) migrated++;
    } catch (err) {
      console.error("Failed to migrate resource:", resource.title, err);
    }
  }

  // Clear guest data after migration
  localStorage.removeItem("guestResources");
  return migrated;
};
