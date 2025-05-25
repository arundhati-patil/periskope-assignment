import type { Express, RequestHandler } from "express";

// Dummy session middleware (does nothing)
export function getSession() {
  return (req: any, res: any, next: any) => next();
}

// SetupAuth does nothing
export async function setupAuth(app: Express) {
  // No authentication!
}

// Always "authenticate" as demo user
export const isAuthenticated: RequestHandler = (req, res, next) => {
  req.user = {
    claims: {
      sub: "demo-user",
      email: "demo@example.com",
      first_name: "Demo",
      last_name: "User",
      profile_image_url: "https://api.dicebear.com/7.x/avatars/svg?seed=Demo"
    }
  };
  next();
};
