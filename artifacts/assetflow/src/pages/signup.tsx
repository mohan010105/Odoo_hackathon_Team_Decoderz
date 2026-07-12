import * as React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useListDepartments } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hexagon, Eye, EyeOff, Loader2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const { signup, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: departments, isLoading: isDeptsLoading } = useListDepartments();

  const [name, setName] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] = React.useState("employee");
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [tempAvatarUrl, setTempAvatarUrl] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file type",
        description: "Please upload an image file (PNG/JPG).",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/attachments/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-name": file.name
        },
        body: file
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      const fileData = await response.json();
      setTempAvatarUrl(fileData.url);
      toast({
        title: "Photo uploaded",
        description: "Your profile photo preview is updated.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Something went wrong during upload.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Redirect to dashboard if logged in
  React.useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const validateForm = (): boolean => {
    if (!name.trim() || !employeeId.trim() || !departmentId || !email.trim() || !password || !confirmPassword || !role) {
      toast({
        title: "Missing fields",
        description: "All fields are required to register your account.",
        variant: "destructive"
      });
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return false;
    }

    if (password.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return false;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      toast({
        title: "Weak password",
        description: "Password must contain uppercase, lowercase, numbers, and special characters.",
        variant: "destructive"
      });
      return false;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords mismatch",
        description: "Confirm password does not match original password.",
        variant: "destructive"
      });
      return false;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms and conditions",
        description: "You must accept the terms and conditions to proceed.",
        variant: "destructive"
      });
      return false;
    }

    if (phone.trim()) {
      const phoneRegex = /^\+?[0-9\s\-()]{7,15}$/;
      if (!phoneRegex.test(phone)) {
        toast({
          title: "Invalid phone number",
          description: "Please enter a valid phone number format.",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const registeredUser = await signup({
        name,
        employeeId,
        departmentId: Number(departmentId),
        email,
        phone: phone || undefined,
        password,
        role
      });
      if (registeredUser && tempAvatarUrl) {
        localStorage.setItem(`af_avatar_url_${registeredUser.id}`, tempAvatarUrl);
      }
    } catch (err) {
      // Handled in auth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black py-12 px-4">
      <Card className="w-full max-w-xl border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

        <CardHeader className="space-y-1 text-center pt-8">
          <div className="flex justify-center mb-1">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Hexagon className="h-6 w-6 fill-blue-500/20" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
            Create Account
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Register your employee profile in AssetFlow ERP
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center space-y-2 pb-4">
              <div className="relative group">
                <div className="h-20 w-20 rounded-full border border-slate-800 overflow-hidden bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-xl select-none">
                  {tempAvatarUrl ? (
                    <img src={tempAvatarUrl} alt="Avatar Preview" className="h-full w-full object-cover" />
                  ) : (
                    "Avatar"
                  )}
                </div>
                <label className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-blue-600 border border-slate-800 text-white flex items-center justify-center cursor-pointer shadow hover:bg-blue-500 transition-colors">
                  {isUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Profile Photo (Optional)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 rounded-lg placeholder-slate-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Employee ID
                </Label>
                <Input
                  id="employeeId"
                  placeholder="EMP-XXXXX"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 rounded-lg placeholder-slate-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Department
                </Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 text-slate-300 rounded-lg">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    {isDeptsLoading ? (
                      <SelectItem value="loading" disabled>Loading departments...</SelectItem>
                    ) : (
                      departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Select Role
                </Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 text-slate-300 rounded-lg">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="department_head">Department Head</SelectItem>
                    <SelectItem value="asset_manager">Asset Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Work Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 rounded-lg placeholder-slate-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 rounded-lg placeholder-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 pr-10 rounded-lg placeholder-slate-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-900/50 border-slate-800 focus:border-blue-500 text-slate-100 rounded-lg placeholder-slate-600"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                className="border-slate-800 text-blue-500 focus:ring-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label
                htmlFor="terms"
                className="text-xs text-slate-400 font-medium cursor-pointer select-none"
              >
                I accept the terms and conditions of AssetFlow ERP.
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium h-10.5 rounded-lg transition-colors shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors ml-1">
                Log in here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
