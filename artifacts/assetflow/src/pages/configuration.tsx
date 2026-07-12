import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeRoleBadge } from "@/components/badges";

export default function Configuration() {
  const roles = [
    {
      role: "admin",
      title: "Administrator",
      description: "Full system access. Can modify structural data, configurations, and manage user roles."
    },
    {
      role: "asset_manager",
      title: "Asset Manager",
      description: "Can create, update, and manage all assets globally. Responsible for overall inventory health."
    },
    {
      role: "department_head",
      title: "Department Head",
      description: "Can view and manage assets allocated to their specific department and its employees."
    },
    {
      role: "employee",
      title: "Employee",
      description: "Can view assets allocated to them, request new assets, and report issues."
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <p className="text-sm text-muted-foreground">System settings and role descriptions.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Role Access Levels</CardTitle>
            <CardDescription>Understanding permissions in AssetFlow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((r) => (
                <div key={r.role} className="flex flex-col space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{r.title}</h3>
                    <EmployeeRoleBadge role={r.role} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {r.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
