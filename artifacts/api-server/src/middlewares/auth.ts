import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { employeesTable, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    employeeId: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    departmentId: number | null;
    departmentName: string | null;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing Bearer token" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Supabase environment variables (SUPABASE_URL/SUPABASE_ANON_KEY) are missing on the server");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    // Call Supabase GoTrue API to verify the JWT token
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": supabaseAnonKey
      }
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      logger.warn({ status: response.status, errorMsg }, "Supabase token validation failed");
      res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
      return;
    }

    const userData = (await response.json()) as any;
    const email = userData.email;

    if (!email) {
      res.status(401).json({ error: "Unauthorized: No email address associated with this session token" });
      return;
    }

    // Fetch matching employee record
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email));

    if (!employee) {
      res.status(403).json({ error: "Forbidden: Employee record not found in the system database" });
      return;
    }

    if (employee.status !== "active") {
      res.status(403).json({ error: "Forbidden: Employee account is currently deactivated" });
      return;
    }

    // Fetch department name if applicable
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

    req.user = {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone ?? null,
      role: employee.role,
      departmentId: employee.departmentId ?? null,
      departmentName
    };

    next();
  } catch (err: any) {
    logger.error({ err }, "Error in requireAuth middleware");
    res.status(500).json({ error: "Internal server authentication error" });
    return;
  }
}
