import { Badge } from "@/components/ui/badge"
import { AssetStatus, AssetCondition, DepartmentStatus, EmployeeStatus, EmployeeRole, AssetCategoryStatus } from "@workspace/api-client-react"

export function AssetStatusBadge({ status }: { status: string }) {
  switch (status) {
    case AssetStatus.available:
      return <Badge variant="success">Available</Badge>
    case AssetStatus.allocated:
      return <Badge variant="info">Allocated</Badge>
    case AssetStatus.reserved:
      return <Badge variant="warning">Reserved</Badge>
    case AssetStatus.under_maintenance:
      return <Badge variant="orange">Maintenance</Badge>
    case AssetStatus.lost:
      return <Badge variant="danger">Lost</Badge>
    case AssetStatus.retired:
      return <Badge variant="neutral">Retired</Badge>
    case AssetStatus.disposed:
      return <Badge variant="outline" className="text-slate-500 border-slate-200">Disposed</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function AssetConditionBadge({ condition }: { condition: string }) {
  switch (condition) {
    case AssetCondition.excellent:
      return <Badge variant="success">Excellent</Badge>
    case AssetCondition.good:
      return <Badge variant="info">Good</Badge>
    case AssetCondition.fair:
      return <Badge variant="warning">Fair</Badge>
    case AssetCondition.poor:
      return <Badge variant="danger">Poor</Badge>
    default:
      return <Badge variant="outline">{condition}</Badge>
  }
}

export function EmployeeRoleBadge({ role }: { role: string }) {
  switch (role) {
    case EmployeeRole.admin:
      return <Badge variant="purple">Admin</Badge>
    case EmployeeRole.asset_manager:
      return <Badge variant="info">Asset Manager</Badge>
    case EmployeeRole.department_head:
      return <Badge variant="indigo">Dept Head</Badge>
    case EmployeeRole.employee:
      return <Badge variant="neutral">Employee</Badge>
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

export function EntityStatusBadge({ status }: { status: string }) {
  if (status === DepartmentStatus.active || status === EmployeeStatus.active || status === AssetCategoryStatus.active) {
    return <Badge variant="success">Active</Badge>
  }
  if (status === DepartmentStatus.inactive || status === EmployeeStatus.inactive || status === AssetCategoryStatus.inactive) {
    return <Badge variant="neutral">Inactive</Badge>
  }
  if (status === EmployeeStatus.on_leave) {
    return <Badge variant="warning">On Leave</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}

export function AssetTag({ tag }: { tag: string }) {
  return (
    <span className="font-mono text-xs font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
      {tag}
    </span>
  )
}
