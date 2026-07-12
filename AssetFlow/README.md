# AssetFlow ERP

**Enterprise Asset & Resource Management System**
Built on Odoo 18 Community Edition · Python 3.11 · PostgreSQL

---

## Architecture

```
AssetFlow/
├── backend/
│   ├── odoo/
│   │   ├── odoo-src/               ← Odoo 18 framework (shallow clone)
│   │   └── custom_addons/
│   │       └── assetflow/          ← AssetFlow custom addon
│   │           ├── models/         ← ORM models (af.department, af.employee, …)
│   │           ├── views/          ← XML list/form/kanban/search views
│   │           ├── controllers/    ← Thin HTTP controllers → delegate to services
│   │           ├── security/       ← Groups, ACL, record rules
│   │           ├── services/       ← Business logic (DashboardService, etc.)
│   │           ├── data/           ← Master data (sequences)
│   │           ├── demo/           ← Demo dataset
│   │           ├── tests/          ← TransactionCase unit tests
│   │           ├── static/         ← CSS / JS / images
│   │           ├── __manifest__.py
│   │           └── __init__.py
│   ├── config/
│   │   └── odoo.conf               ← Server configuration
│   ├── scripts/
│   │   ├── start.sh                ← Dev server launcher
│   │   └── install_deps.sh         ← Dependency installer
│   ├── tests/
│   └── requirements.txt
├── docs/
├── database/
├── screenshots/
├── presentation/
├── README.md                       ← This file
└── .gitignore
```

---

## Data Models

| Model | Technical Name | Description |
|---|---|---|
| Department | `af.department` | Organisational unit owning employees and assets |
| Employee | `af.employee` | Staff member within a department |
| Asset Category | `af.asset.category` | Taxonomy for classifying assets |
| Asset | `af.asset` | Physical or digital company asset |
| Asset Allocation | `af.asset.allocation` | Transaction tracking asset allocation to employees |
| Transfer Request | `af.transfer.request` | Request to transfer an allocated asset between employees |
| Allocation History | `af.allocation.history` | Immutable audit trail of all allocation changes |
| Activity | `af.activity` | Centralized immutable activity feed across all modules |
| Notification | `af.notification` | Per-user notification with category, priority, and status |
| Approval | `af.approval` | Centralized approval queue for workflows |
| System Alert | `af.system.alert` | Automated alerts for critical system conditions |

---

## Security Roles

| Role | Access |
|---|---|
| **AssetFlow Employee** | Read own assigned assets |
| **AssetFlow Asset Manager** | Full CRUD on assets & categories; read departments/employees |
| **AssetFlow Administrator** | Unrestricted access including departments and employees |

---

## Business Rules

- **Asset tags** are auto-generated in sequence: `AF-000001`, `AF-000002`, …
- **Employee IDs** are auto-generated: `EMP-00001`, `EMP-00002`, …
- **Soft delete** — assets cannot be hard-deleted; they must be disposed first.
- **Department deactivation** is blocked if active employees remain.
- **Employee deactivation** is blocked if assets are still allocated.
- **Category deactivation** is blocked if non-disposed assets use the category.
- **Activities are immutable** — they can be archived but never deleted.
- **Allocation history** cannot be deleted — it is an immutable audit log.
- **Transfer requests** automatically create approval records in the Approval Center.
- **System alerts** are de-duplicated — repeat scans will not create duplicate alerts.

---

## Screen 10: Unified Activity Center & Notification Hub

### Activity Center

Centralized, immutable activity feed tracking all operations across every module.

| Field | Description |
|---|---|
| Activity ID | Auto-generated: `ACT-000001` |
| Activity Type | 19 types: `asset_created`, `transfer_approved`, `audit_completed`, etc. |
| Module | Source module: `asset`, `allocation`, `transfer`, `booking`, `maintenance`, `audit`, `report`, `auth`, `system` |
| Priority | `low`, `medium`, `high`, `critical` |
| Status | `unread`, `read`, `archived` |
| Date Group | Computed: `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `Older` |

**Key features:**
- Immutable — `unlink()` blocked; archive-only policy
- Activities logged automatically by `ActivityService.log_activity()`
- All models call the service layer instead of creating records directly
- Timeline supports pagination, keyword search, and multi-field filtering

### Notification Center

Per-user notification system with 6 categories and full lifecycle management.

| Feature | Details |
|---|---|
| Categories | `success`, `info`, `warning`, `critical`, `approval`, `reminder` |
| Priorities | `low`, `medium`, `high`, `critical` |
| Status | `unread` → `read` → `archived` |
| Auto-Generation | Created via `ActivityService` when `notify_users` is specified |
| Self-Notification Skip | Users are not notified about their own actions |

### Approval Center

Centralized approval queue for all workflow approvals.

| Feature | Details |
|---|---|
| Types | `transfer`, `booking`, `maintenance`, `audit` |
| Actions | Approve, Reject, Bulk Approve, Bulk Reject |
| Integration | Transfer requests auto-create approval records |
| Sync | Approval decisions propagate back to source records |
| Activity Logging | Every approval decision is logged in the Activity Center |

### System Alerts

Automated scanning for critical conditions, run daily via cron.

| Scanner | Alert Type | Severity |
|---|---|---|
| Overdue Returns | `overdue_return` | High |
| Inactive Assets (30+ days maintenance) | `inactive_asset` | Medium |
| Warranty Expiry (within 30 days) | `warranty_expiry` | Medium |
| Maintenance Delay (14+ days) | `maintenance_delay` | High |

**Lifecycle:** `active` → `acknowledged` → `resolved`

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/assetflow/activities` | GET | Paginated activity timeline |
| `/assetflow/activities/count` | GET | Unread and today counts |
| `/assetflow/activities/mark-read` | POST | Mark activities as read |
| `/assetflow/activities/archive` | POST | Archive activities |
| `/assetflow/notifications` | GET | User's notifications |
| `/assetflow/notifications/count` | GET | Notification counts |
| `/assetflow/notifications/mark-read` | POST | Mark notifications read |
| `/assetflow/notifications/mark-all-read` | POST | Mark all as read |
| `/assetflow/approvals` | GET | List approvals |
| `/assetflow/approvals/approve` | POST | Approve requests |
| `/assetflow/approvals/reject` | POST | Reject requests |
| `/assetflow/alerts` | GET | Active system alerts |
| `/assetflow/alerts/acknowledge` | POST | Acknowledge alert |
| `/assetflow/alerts/resolve` | POST | Resolve alert |
| `/assetflow/alerts/count` | GET | Alert counts |
| `/assetflow/dashboard/kpis` | GET | Dashboard KPIs |
| `/assetflow/dashboard/summary` | GET | Full dashboard summary |

### Service Layer Architecture

All business logic is encapsulated in service classes. Controllers and models never build queries directly.

```
Controller → Service → Model
   ↓             ↓
 JSON         ORM / DB
```

| Service | Responsibility |
|---|---|
| `ActivityService` | Activity logging, notification generation, timeline queries |
| `NotificationService` | CRUD, bulk operations, count queries |
| `AlertService` | Scan delegation, active alert queries |
| `DashboardService` | KPI aggregation, breakdown queries |
| `SequenceService` | Centralized ID generation |

---

## Installation & Local Setup

### Prerequisites

- **Node.js**: v20 or later (v25 recommended)
- **Python**: v3.10 / v3.11
- **PostgreSQL**: v14 or later (running locally or remotely)
- **Odoo 18**: Included inside [odoo-src](file:///d:/Projects/Odoo-Architect/AssetFlow/backend/odoo/odoo-src/)

---

### Step 1: Install Node Dependencies

Run the following command at the repository root to install and link all frontend, database (Drizzle), and API server packages:

```bash
npm install
```

---

### Step 2: Install Python Dependencies

#### On Windows (PowerShell):
```powershell
PowerShell AssetFlow/backend/scripts/install_deps.ps1
```

#### On Unix/Linux/macOS (Bash):
```bash
bash AssetFlow/backend/scripts/install_deps.sh
```

---

### Step 3: Set Environment Variables

Create a local `.env` file at the root of the project (copying from `.env.example`). Define your PostgreSQL parameters:

```env
DATABASE_URL=postgresql://your_pg_user:your_pg_password@localhost:5432/assetflow_odoo
PORT=5000
```

To configure Odoo environment variables, set them in your terminal session or start Odoo passing custom credentials.

---

### Step 4: Run the Services

#### 1 · Start Odoo Backend Server

##### On Windows (PowerShell):
```powershell
PowerShell AssetFlow/backend/scripts/start.ps1
```

##### On Unix/Linux/macOS (Bash):
```bash
export PGHOST=localhost
export PGPORT=5432
export PGUSER=your_pg_user
export PGPASSWORD=your_pg_password
bash AssetFlow/backend/scripts/start.sh
```

*On first boot, Odoo automatically creates and boots the `assetflow_odoo` database and installs the custom addon module.*

#### 2 · Start React Frontend & Node API Servers

Run the concurrent local development servers:
```bash
npm run dev
```

---

### Step 5: Access the Interfaces

- **Odoo Enterprise Dashboard**: [http://localhost:8069](http://localhost:8069) (Admin login: `admin` / `admin`)
- **React Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Sandbox API Server**: [http://localhost:5000](http://localhost:5000)

---

## Workspace Workspace Commands

* `npm run build` — compiles and builds all packages
* `npm run typecheck` — runs typescript typecheck across all packages
* `npm run codegen --workspace=@workspace/api-spec` — regenerates client queries and zod validators from the OpenAPI spec
* `npm run push --workspace=@workspace/db` — pushes schema updates to the PostgreSQL sandbox database using Drizzle


---

## Development Workflow

1. Edit models in `backend/odoo/custom_addons/assetflow/models/`
2. Restart the server — Odoo auto-detects `--dev=all` changes
3. For schema changes run with `--update=assetflow`
4. Run tests: `python3.11 backend/odoo/odoo-src/odoo-bin -c backend/config/odoo.conf -d assetflow_odoo --test-enable --stop-after-init`

---

## Naming Standards

| Artefact | Convention | Example |
|---|---|---|
| Model name | `af.<noun>` | `af.department` |
| Model class | `Af<Noun>` (PascalCase) | `AfDepartment` |
| XML IDs | `<type>_af_<model>_<suffix>` | `view_af_department_list` |
| Menu IDs | `menu_assetflow_<name>` | `menu_assetflow_departments` |
| Action IDs | `action_af_<model>` | `action_af_department` |
| Security group IDs | `group_assetflow_<role>` | `group_assetflow_admin` |
| Sequence codes | `af.<model>.sequence` | `af.asset.sequence` |

---

## Coding Standards

- Follow **PEP 8** and **Odoo coding guidelines**
- **SOLID principles** throughout — one responsibility per class/method
- Controllers are **thin** — they validate input and delegate to services
- Models handle **ORM logic only** — no HTTP, no formatting
- **Services** (`services/`) own all reusable business logic
- No hardcoded values — use constants, sequences, or configuration models
- All public methods have **docstrings**
- Use `_logger = logging.getLogger(__name__)` in every module

---

## Future Roadmap

| Phase | Status | Features |
|---|---|---|
| **Phase 1** | ✅ Complete | Departments, Employees, Asset Categories, Assets, Dashboard |
| **Phase 2** | ✅ Complete | Asset Allocation, Transfer Requests, Allocation History |
| **Phase 3** | ✅ Complete | Unified Activity Center, Notification Hub, Approval Center, System Alerts |
| **Phase 4** | 🔜 Planned | WebSocket real-time push, Email notifications |
| **Phase 5** | 🔜 Planned | Resource Booking, Maintenance scheduling |
| **Phase 6** | 🔜 Planned | QR code generation, AI-assisted condition assessment |
| **Phase 7** | 🔜 Planned | Advanced analytics, Department ranking, Asset health scores |
