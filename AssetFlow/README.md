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

| Phase | Features |
|---|---|
| **Phase 2** | Asset Allocation workflow, Transfer requests, Booking system |
| **Phase 3** | Maintenance scheduling, Preventive maintenance |
| **Phase 4** | Notifications, Email alerts, Activity reminders |
| **Phase 5** | QR code generation, Audit trail, AI-assisted condition assessment |
| **Phase 6** | Advanced analytics, Department ranking, Asset health scores |
