// Bypass the API call – always return demo user
export function useAuth() {
  const user = {
    id: "demo-user",
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
    profileImageUrl: "https://api.dicebear.com/7.x/avatars/svg?seed=Demo"
  };
  return {
    user,
    isLoading: false,
    isAuthenticated: true,
  };
}
