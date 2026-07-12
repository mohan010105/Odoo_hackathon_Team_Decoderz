import * as React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hexagon, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Validation error",
        description: "Please enter your registered email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setIsSent(true);
    } catch (err) {
      // Handled in auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

        {!isSent ? (
          <>
            <CardHeader className="space-y-2 text-center pt-8">
              <div className="flex justify-center mb-2">
                <div className="h-11 w-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Hexagon className="h-6 w-6 fill-blue-500/20" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
                Forgot Password
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Enter your work email and we'll send reset instructions
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    Work Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 pl-10 h-10.5 rounded-lg placeholder-slate-600"
                      required
                    />
                  </div>
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
                      Sending link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <Link href="/login" className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to Sign In
                </Link>
              </CardFooter>
            </form>
          </>
        ) : (
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-200 bg-clip-text text-transparent">
              Check Your Email
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              If the email <strong>{email}</strong> is registered, password recovery instructions have been successfully sent. Please check your inbox and spam folders.
            </p>
            <div className="pt-4 flex justify-center">
              <Link href="/login" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                <ArrowLeft className="h-4 w-4" /> Return to Login
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
