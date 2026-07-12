import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Lock, User, Phone, Mail, Building, Shield, KeyRound, Loader2, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  // Notification states
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [smsNotifications, setSmsNotifications] = React.useState(false);
  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = React.useState(false);

  // Sync profile data on load
  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || "");
      const storedAvatar = localStorage.getItem(`af_avatar_url_${user.id}`);
      if (storedAvatar) {
        setAvatarUrl(storedAvatar);
      }
      
      const storedPrefs = localStorage.getItem(`af_notification_preferences_${user.id}`);
      if (storedPrefs) {
        try {
          const parsed = JSON.parse(storedPrefs);
          setEmailNotifications(parsed.email ?? true);
          setSmsNotifications(parsed.sms ?? false);
          setPushNotifications(parsed.push ?? true);
        } catch (e) {
          console.error("Failed to parse notification preferences:", e);
        }
      }
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Validation error",
        description: "Name cannot be left empty.",
        variant: "destructive"
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(name, phone);
    } catch (err) {
      // Toast message is handled inside updateProfile hook
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Validation error",
        description: "Please specify your new password.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords mismatch",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    } catch (err) {
      // Handled in auth hook
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingNotifications(true);
    try {
      localStorage.setItem(
        `af_notification_preferences_${user?.id}`,
        JSON.stringify({
          email: emailNotifications,
          sms: smsNotifications,
          push: pushNotifications
        })
      );
      toast({
        title: "Preferences updated",
        description: "Your notification preferences were saved successfully.",
      });
    } catch (err) {
      toast({
        title: "Error saving preferences",
        description: "Something went wrong.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

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
      const token = localStorage.getItem("af_access_token");
      const response = await fetch("/api/attachments/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "Authorization": `Bearer ${token}`,
          "x-file-name": file.name
        },
        body: file
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      const fileData = await response.json();
      setAvatarUrl(fileData.url);
      localStorage.setItem(`af_avatar_url_${user.id}`, fileData.url);
      
      toast({
        title: "Avatar updated",
        description: "Your profile photo has been updated successfully.",
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

  if (!user) return null;

  // Get initials for avatar fallback
  const getInitials = (userName: string) => {
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">My Profile</h1>
          <p className="text-slate-400 text-sm">
            Manage your account settings, profile information, and security preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-600/10 text-blue-400 border-blue-500/20 capitalize px-3 py-1 font-semibold text-xs rounded-full">
            Role: {user.role.replace("_", " ")}
          </Badge>
          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 px-3 py-1 font-semibold text-xs rounded-full">
            ID: {user.employeeId}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary Info */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-slate-800 bg-slate-950/40 text-slate-200">
            <CardHeader className="text-center pt-8">
              <div className="flex justify-center relative">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-full border-4 border-slate-800 overflow-hidden bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-3xl select-none">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-blue-600 border border-slate-800 text-white flex items-center justify-center cursor-pointer shadow hover:bg-blue-500 transition-colors">
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
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
              </div>
              <CardTitle className="text-xl font-bold mt-4">{user.name}</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-slate-800/60 pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-slate-400 font-medium">Role:</span>
                <span className="ml-auto capitalize font-semibold">{user.role.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-blue-500" />
                <span className="text-slate-400 font-medium">Department:</span>
                <span className="ml-auto font-semibold">{user.departmentName || "General"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="text-slate-400 font-medium">Work Email:</span>
                <span className="ml-auto font-medium text-slate-300 select-all">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-blue-500" />
                <span className="text-slate-400 font-medium">Phone:</span>
                <span className="ml-auto font-semibold text-slate-300">{user.phone || "Not set"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Update Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile settings */}
          <Card className="border-slate-800 bg-slate-950/40 text-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <User className="h-5 w-5 text-blue-500" /> Account Settings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Update your personal name and contact phone number.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleProfileSubmit}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof-name" className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
                      Full Name
                    </Label>
                    <Input
                      id="prof-name"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:border-blue-500 text-slate-100"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prof-phone" className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
                      Phone Number
                    </Label>
                    <Input
                      id="prof-phone"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:border-blue-500 text-slate-100"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t border-slate-800/60 pt-4 pb-4">
                <Button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Change Password settings */}
          <Card className="border-slate-800 bg-slate-950/40 text-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <KeyRound className="h-5 w-5 text-blue-500" /> Security Preferences
              </CardTitle>
              <CardDescription className="text-slate-400">
                Change your account password.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof-new-pass" className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
                      New Password
                    </Label>
                    <Input
                      id="prof-new-pass"
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:border-blue-500 text-slate-100"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prof-confirm-pass" className="text-xs text-slate-300 font-semibold uppercase tracking-wider">
                      Confirm New Password
                    </Label>
                    <Input
                      id="prof-confirm-pass"
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:border-blue-500 text-slate-100"
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t border-slate-800/60 pt-4 pb-4">
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Notification Preferences settings */}
          <Card className="border-slate-800 bg-slate-950/40 text-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Bell className="h-5 w-5 text-blue-500" /> Notification Preferences
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure how you want to receive alerts and system notifications.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleNotificationsSubmit}>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-slate-800/80 rounded-lg bg-slate-900/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-slate-200">Email Notifications</Label>
                    <p className="text-xs text-slate-500">Receive system alerts and updates via email.</p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-slate-800/80 rounded-lg bg-slate-900/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-slate-200">SMS Alerts</Label>
                    <p className="text-xs text-slate-500">Get text notifications for critical asset allocations.</p>
                  </div>
                  <Switch
                    id="sms-notif"
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border border-slate-800/80 rounded-lg bg-slate-900/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-slate-200">Push Notifications</Label>
                    <p className="text-xs text-slate-500">Allow browser popups for immediate alerts.</p>
                  </div>
                  <Switch
                    id="push-notif"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t border-slate-800/60 pt-4 pb-4">
                <Button
                  type="submit"
                  disabled={isUpdatingNotifications}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {isUpdatingNotifications ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving preferences...
                    </>
                  ) : (
                    "Save Preferences"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
