import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Validates password strength:
 * - Minimum 8 characters
 * - Uppercase letter
 * - Lowercase letter
 * - Digit
 * - Special character
 */
function isPasswordStrong(password: string): boolean {
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

// 1. SIGNUP
router.post("/auth/signup", async (req, res) => {
  try {
    const { name, employeeId, departmentId, email, phone, password, role } = req.body;

    if (!name || !employeeId || !departmentId || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({
        error: "Weak password: Must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters."
      });
    }

    if (role === "admin") {
      return res.status(400).json({ error: "Administrator accounts cannot be self-registered" });
    }

    // Check duplicate email
    const [existingEmail] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email));
    if (existingEmail) {
      return res.status(400).json({ error: "Email address already registered" });
    }

    // Check duplicate employee ID
    const [existingEmpId] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.employeeId, employeeId));
    if (existingEmpId) {
      return res.status(400).json({ error: "Employee ID already exists" });
    }

    // Check if department exists
    const [existingDept] = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.id, Number(departmentId)));
    if (!existingDept) {
      return res.status(400).json({ error: "Selected Department does not exist" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Supabase environment configuration missing on server during signup");
      return res.status(500).json({ error: "Server database configuration error" });
    }

    // Register user in Supabase
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as any;
      return res.status(response.status).json({ error: errRes.msg || "Supabase user registration failed" });
    }

    const sbData = (await response.json()) as any;
    const accessToken = sbData.access_token || "";
    const refreshToken = sbData.refresh_token || "";

    // Create employee record
    const [employee] = await db
      .insert(employeesTable)
      .values({
        name,
        employeeId,
        email,
        phone: phone || null,
        departmentId: Number(departmentId),
        role,
        status: "active"
      })
      .returning();

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        departmentId: employee.departmentId,
        departmentName: existingDept.name
      }
    });
  } catch (err: any) {
    logger.error({ err }, "SignUp error");
    return res.status(500).json({ error: "Signup failed due to server error" });
  }
});

// 2. LOGIN
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase configuration missing on server" });
    }

    // Authenticate with Supabase
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as any;
      return res.status(401).json({ error: errRes.error_description || errRes.msg || "Invalid credentials" });
    }

    const sbData = (await response.json()) as any;
    const accessToken = sbData.access_token;
    const refreshToken = sbData.refresh_token;

    // Fetch corresponding employee record
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email));

    if (!employee) {
      return res.status(403).json({ error: "Account not registered in AssetFlow ERP database" });
    }

    if (employee.status !== "active") {
      return res.status(403).json({ error: "Employee account is currently deactivated" });
    }

    let departmentName: string | null = null;
    if (employee.departmentId) {
      const [dept] = await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, employee.departmentId));
      if (dept) {
        departmentName = dept.name;
      }
    }

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        departmentId: employee.departmentId,
        departmentName
      }
    });
  } catch (err: any) {
    logger.error({ err }, "Login error");
    return res.status(500).json({ error: "Login failed due to server error" });
  }
});

// 3. LOGOUT
router.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(200).json({ message: "Successfully logged out" });
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": supabaseAnonKey
        }
      });
    }

    return res.status(200).json({ message: "Successfully logged out" });
  } catch (err: any) {
    logger.error({ err }, "Logout error");
    return res.status(200).json({ message: "Successfully logged out" });
  }
});

// 4. FORGOT PASSWORD
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Server credentials missing" });
    }

    // Check if employee exists first to avoid invalid Supabase triggers
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email));

    // Prevent enumeration attack: always return 200 OK success
    if (employee && employee.status === "active") {
      const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/recover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errRes = await response.json();
        logger.error({ errRes }, "Supabase password recovery link trigger failed");
      }
    }

    return res.status(200).json({ message: "Password reset instructions sent successfully" });
  } catch (err: any) {
    logger.error({ err }, "Forgot password error");
    return res.status(200).json({ message: "Password reset instructions sent successfully" });
  }
});

// 5. RESET PASSWORD
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({
        error: "Weak password: Must be at least 8 characters and contain uppercase, lowercase, digits, and symbols."
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase parameters missing" });
    }

    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as any;
      return res.status(response.status).json({ error: errRes.msg || "Password reset failed" });
    }

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err: any) {
    logger.error({ err }, "Reset password error");
    return res.status(500).json({ error: "Failed to reset password due to internal error" });
  }
});

// 6. AUTH ME
router.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  return res.status(200).json(req.user);
});

// 7. UPDATE PROFILE
router.post("/auth/update-profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const email = req.user!.email;

    const [updated] = await db
      .update(employeesTable)
      .set({ name, phone })
      .where(eq(employeesTable.email, email))
      .returning();

    let departmentName: string | null = null;
    if (updated.departmentId) {
      const [dept] = await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, updated.departmentId));
      if (dept) {
        departmentName = dept.name;
      }
    }

    return res.status(200).json({
      id: updated.id,
      employeeId: updated.employeeId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      departmentId: updated.departmentId,
      departmentName
    });
  } catch (err: any) {
    logger.error({ err }, "Update profile error");
    return res.status(500).json({ error: "Failed to update profile details" });
  }
});

// 8. CHANGE PASSWORD
router.post("/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({
        error: "Weak password: Must be at least 8 characters and contain uppercase, lowercase, digits, and symbols."
      });
    }

    const authHeader = req.headers.authorization!;
    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Supabase configuration missing" });
    }

    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as any;
      return res.status(response.status).json({ error: errRes.msg || "Failed to change password" });
    }

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err: any) {
    logger.error({ err }, "Change password error");
    return res.status(500).json({ error: "Failed to change password" });
  }
});

// 9. REFRESH TOKEN
router.post("/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Supabase environment configuration missing on server during token refresh");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Refresh token with Supabase GoTrue API
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      const errRes = (await response.json()) as any;
      return res.status(401).json({ error: errRes.error_description || errRes.msg || "Invalid refresh token" });
    }

    const sbData = (await response.json()) as any;
    return res.status(200).json({
      accessToken: sbData.access_token,
      refreshToken: sbData.refresh_token,
      expiresIn: sbData.expires_in
    });
  } catch (err: any) {
    logger.error({ err }, "Token refresh error");
    return res.status(500).json({ error: "Token refresh failed due to server error" });
  }
});

export default router;
