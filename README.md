# 🚀 AssetFlow ERP

> **Enterprise Asset & Resource Management System built on Odoo 18 Community Edition**

[![Odoo](https://img.shields.io/badge/Odoo-18.0-purple.svg)]()
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)]()
[![License](https://img.shields.io/badge/License-LGPL--3-green.svg)]()

---

## 📌 Overview

AssetFlow ERP is a comprehensive Enterprise Asset & Resource Management solution developed for the **Odoo Hackathon**. It enables organizations to efficiently manage their physical assets throughout the entire lifecycle—from registration and allocation to booking, maintenance, auditing, reporting, and notifications.

The application is designed using **Odoo 18 Community Edition** with a modular, scalable architecture following enterprise software engineering principles.

---

# 🎯 Problem Statement

Organizations often struggle with:

- Inefficient asset tracking
- Manual allocation processes
- Resource booking conflicts
- Poor maintenance visibility
- Missing audit trails
- Lack of centralized reporting

AssetFlow solves these challenges through a unified ERP platform with automated workflows, role-based access, real-time dashboards, and audit-ready records.

---

# ✨ Key Features

## 🔐 Authentication & Security

- Secure Login
- Role-Based Access Control (RBAC)
- Admin, Asset Manager, Department Head & Employee roles
- Permission-based access
- Audit-ready user actions

---

## 🏢 Organization Management

- Department Management
- Employee Directory
- Asset Categories
- Organizational hierarchy

---

## 💻 Asset Management

- Asset Registration
- Auto-generated Asset IDs
- QR Code Ready
- Asset Lifecycle Tracking
- Asset Status Management
- Asset History

---

## 🔄 Asset Allocation & Transfer

- Asset Allocation
- Asset Return
- Transfer Approval Workflow
- Allocation History
- Department Assignment
- Employee Assignment

---

## 📅 Resource Booking

- Shared Resource Booking
- Calendar View
- Conflict Detection
- Booking Approval
- Booking History
- Availability Tracking

---

## 🛠 Maintenance Management

- Maintenance Requests
- Technician Assignment
- Priority Levels
- Kanban Workflow
- Maintenance History
- Resolution Tracking

---

## 📋 Asset Audit

- Audit Scheduling
- Asset Verification
- Missing Asset Detection
- Discrepancy Reports
- Audit History

---

## 📊 Reports & Analytics

- Dashboard KPIs
- Asset Reports
- Department Reports
- Maintenance Reports
- Booking Reports
- Graph Views
- Pivot Views
- PDF Export
- Excel Export

---

## 🔔 Activity & Notification Center

- Real-Time Activity Timeline
- Notifications
- Approval Center
- System Alerts
- Dashboard Integration

---

# 🏗 Architecture

```
AssetFlow

├── backend
│   ├── Odoo
│   ├── Models
│   ├── Controllers
│   ├── Services
│   ├── Security
│   ├── Reports
│   └── Data
│
├── frontend
│   ├── Components
│   ├── Pages
│   ├── Layouts
│   ├── Assets
│   └── Styles
│
├── database
│
├── docs
│
├── screenshots
│
└── presentation
```

---

# 🛠 Technology Stack

### Backend

- Odoo 18 Community Edition
- Python
- PostgreSQL

### Frontend

- XML Views
- OWL Components
- Bootstrap
- JavaScript

### Database

- PostgreSQL

### Reports

- QWeb Reports
- PDF
- Excel

### Development

- Git
- GitHub
- Anti Gravity

---

# 📂 Core Modules

- Authentication
- Dashboard
- Departments
- Employees
- Asset Categories
- Assets
- Allocation
- Transfer
- Resource Booking
- Maintenance
- Audit
- Reports
- Notifications

---

# 🔄 Asset Lifecycle

```
Register

↓

Available

↓

Allocated

↓

Transferred

↓

Returned

↓

Maintenance

↓

Audit

↓

Retired
```

---

# 📊 Dashboard

The dashboard provides:

- Total Assets
- Available Assets
- Allocated Assets
- Bookings
- Maintenance Requests
- Pending Audits
- Department Statistics
- Recent Activities

---

# 🔐 Security

Role-Based Access Control

### Admin

- Full Access

### Asset Manager

- Manage Assets
- Allocation
- Booking
- Maintenance

### Department Head

- Department Approval
- Reports

### Employee

- View Assigned Assets
- Booking Requests
- Maintenance Requests

---

# 📸 Screenshots

```
screenshots/

login.png

dashboard.png

assets.png

allocation.png

booking.png

maintenance.png

audit.png

reports.png

notifications.png
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/<your-username>/AssetFlow.git

cd AssetFlow
```

Install dependencies

```bash
npm install
```

Run development server

```bash
npm run dev
```

Backend

```bash
python odoo-bin -c odoo.conf
```

---

# 📈 Future Enhancements

- QR Scanner
- Mobile Companion
- AI Asset Health Prediction
- Predictive Maintenance
- Smart Asset Recommendations
- Barcode Integration
- Multi-company Support

---

# 👨‍💻 Team

Developed for the **Odoo Hackathon**.

---

# 📄 License

LGPL-3

---

# ⭐ Acknowledgements

- Odoo Community
- Odoo Hackathon Team
- PostgreSQL
- Python Community

---

## 🌟 Thank You

If you like this project, consider giving it a ⭐ on GitHub.