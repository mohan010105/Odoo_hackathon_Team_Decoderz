import * as React from "react";
import { useLocation } from "wouter";
import { 
  AuthUser,
  useAuthLogin,
  useAuthSignUp,
  useAuthForgotPassword,
  useAuthResetPassword,
  useAuthUpdateProfile,
  useAuthChangePassword,
  authMe,
  setAuthTokenGetter
} from "@workspace/api-client-react";
import { useToast } from "./use-toast";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  updateProfile: (name: string, phone: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  isAdmin: boolean;
  isAssetManager: boolean;
  isDepartmentHead: boolean;
  isEmployee: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Register token getter globally for custom fetch
if (typeof window !== "undefined") {
  setAuthTokenGetter(async () => {
    let token = localStorage.getItem("af_access_token");
    const refreshToken = localStorage.getItem("af_refresh_token");
    if (!token || !refreshToken) {
      return token;
    }

    try {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        // Refresh token if it expires in less than 5 minutes (300s)
        if (decoded.exp - now < 300) {
          const response = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ refreshToken })
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem("af_access_token", data.accessToken);
            localStorage.setItem("af_refresh_token", data.refreshToken);
            token = data.accessToken;
          } else {
            console.warn("Session auto-refresh failed, response code:", response.status);
          }
        }
      }
    } catch (err) {
      console.error("Error during auto token refresh validation:", err);
    }
    return token;
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useAuthLogin();
  const signupMutation = useAuthSignUp();
  const forgotPasswordMutation = useAuthForgotPassword();
  const resetPasswordMutation = useAuthResetPassword();
  const updateProfileMutation = useAuthUpdateProfile();
  const changePasswordMutation = useAuthChangePassword();

  // Restore session on mount
  React.useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("af_access_token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch current authenticated user info
        const me = await authMe();
        setUser(me);
      } catch (err) {
        console.error("Failed to restore auth session:", err);
        localStorage.removeItem("af_access_token");
        localStorage.removeItem("af_refresh_token");
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // Handle global session expiration event
  React.useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
      toast({
        title: "Session Expired",
        description: "Your session has expired or is invalid. Please login again.",
        variant: "destructive"
      });
      setLocation("/login");
    }
    window.addEventListener("auth_session_expired", handleSessionExpired);
    return () => window.removeEventListener("auth_session_expired", handleSessionExpired);
  }, [setLocation, toast]);

  const login = React.useCallback(async (email: string, password: string) => {
    try {
      const res = await loginMutation.mutateAsync({ data: { email, password } });
      localStorage.setItem("af_access_token", res.accessToken);
      localStorage.setItem("af_refresh_token", res.refreshToken);
      setUser(res.user);
      toast({
        title: "Welcome back!",
        description: `Logged in successfully as ${res.user.name}.`,
      });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Invalid email or password.",
        variant: "destructive",
      });
      throw err;
    }
  }, [loginMutation, toast, setLocation]);

  const signup = React.useCallback(async (data: any) => {
    try {
      const res = await signupMutation.mutateAsync({ data });
      localStorage.setItem("af_access_token", res.accessToken);
      localStorage.setItem("af_refresh_token", res.refreshToken);
      setUser(res.user);
      toast({
        title: "Account created",
        description: `Successfully registered and logged in as ${res.user.name}.`,
      });
      setLocation("/");
      return res.user;
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message || "Please check your inputs and try again.",
        variant: "destructive",
      });
      throw err;
    }
  }, [signupMutation, toast, setLocation]);

  const logout = React.useCallback(async () => {
    try {
      // Clear local storage tokens immediately for fast UX
      localStorage.removeItem("af_access_token");
      localStorage.removeItem("af_refresh_token");
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out of your session.",
      });
      setLocation("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, [toast, setLocation]);

  const forgotPassword = React.useCallback(async (email: string) => {
    try {
      await forgotPasswordMutation.mutateAsync({ data: { email } });
      toast({
        title: "Instructions sent",
        description: "If the email is registered, password reset instructions have been sent.",
      });
    } catch (err: any) {
      toast({
        title: "Error requesting reset",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
      throw err;
    }
  }, [forgotPasswordMutation, toast]);

  const resetPassword = React.useCallback(async (token: string, password: string) => {
    try {
      await resetPasswordMutation.mutateAsync({ data: { token, password } });

      // Auto login after reset
      try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        if (decoded && decoded.email) {
          toast({
            title: "Password reset successful",
            description: "Your password has been updated. Logging you in automatically...",
          });
          await login(decoded.email, password);
          return;
        }
      } catch (e) {
        console.error("Auto-login failed:", e);
      }

      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now login.",
      });
      setLocation("/login");
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err.message || "Invalid or expired token.",
        variant: "destructive",
      });
      throw err;
    }
  }, [resetPasswordMutation, toast, setLocation, login]);

  const updateProfile = React.useCallback(async (name: string, phone: string) => {
    try {
      const updated = await updateProfileMutation.mutateAsync({ data: { name, phone } });
      setUser(updated);
      toast({
        title: "Profile updated",
        description: "Your account details were saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Profile update failed",
        description: err.message || "Please check your inputs.",
        variant: "destructive",
      });
      throw err;
    }
  }, [updateProfileMutation, toast]);

  const changePassword = React.useCallback(async (newPassword: string) => {
    try {
      await changePasswordMutation.mutateAsync({ data: { newPassword } });
      toast({
        title: "Password updated",
        description: "Your password was changed successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Password change failed",
        description: err.message || "Failed to update password.",
        variant: "destructive",
      });
      throw err;
    }
  }, [changePasswordMutation, toast]);

  const isAdmin = React.useMemo(() => user?.role === "admin", [user]);
  const isAssetManager = React.useMemo(() => user?.role === "asset_manager", [user]);
  const isDepartmentHead = React.useMemo(() => user?.role === "department_head", [user]);
  const isEmployee = React.useMemo(() => user?.role === "employee", [user]);

  const value = React.useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    isAdmin,
    isAssetManager,
    isDepartmentHead,
    isEmployee
  }), [
    user,
    isLoading,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    isAdmin,
    isAssetManager,
    isDepartmentHead,
    isEmployee
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
