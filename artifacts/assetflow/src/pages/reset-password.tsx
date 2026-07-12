import * as React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

  // Extract reset token from URL hash parameters
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        setToken(accessToken);
        return;
      }
    }

    // Fallback: Check standard query params
    const queryParams = new URLSearchParams(window.location.search);
    const tokenParam = queryParams.get("token") || queryParams.get("access_token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setErrorText("Missing or invalid password reset link. Please request a new recovery link.");
    }
  }, []);

  // Compute password strength
  const getPasswordStrength = () => {
    if (!password) return { label: "Empty", score: 0, color: "bg-slate-800" };
    
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { label: "Too Weak", score: 25, color: "bg-red-500" };
      case 2:
        return { label: "Weak", score: 50, color: "bg-orange-500" };
      case 3:
        return { label: "Strong", score: 75, color: "bg-yellow-500" };
      case 4:
        return { label: "Excellent", score: 100, color: "bg-emerald-500" };
      default:
        return { label: "Invalid", score: 0, color: "bg-slate-800" };
    }
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({
        title: "Reset failed",
        description: "Your reset token is missing. Please use a valid email link.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 8 || strength.score < 75) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords mismatch",
        description: "Confirm password must match your new password.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      // Auto-logs in or redirects to login
    } catch (err) {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

        <CardHeader className="space-y-2 text-center pt-8">
          <div className="flex justify-center mb-2">
            <div className="h-11 w-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Hexagon className="h-6 w-6 fill-blue-500/20" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
            Reset Password
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Set a strong new password for your ERP account
          </CardDescription>
        </CardHeader>

        {errorText ? (
          <CardContent className="pb-8 pt-4 text-center space-y-4">
            <div className="flex justify-center text-red-400">
              <AlertCircle className="h-12 w-12" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {errorText}
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                className="border-slate-800 hover:bg-slate-900 text-slate-300"
                onClick={() => setLocation("/login")}
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pass" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="new-pass"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 pl-10 pr-10 h-10.5 rounded-lg placeholder-slate-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {password && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={
                      strength.label === "Excellent" ? "text-emerald-400" :
                      strength.label === "Strong" ? "text-yellow-400" : "text-red-400"
                    }>
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.score}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-normal block">
                    Use 8+ characters, uppercase, lowercase, numbers, and symbols.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-pass" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-pass"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 h-10.5 rounded-lg placeholder-slate-600"
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pb-8">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium h-10.5 rounded-lg transition-colors shadow-lg active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Resetting password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
