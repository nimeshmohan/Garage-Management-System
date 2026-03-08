# Car Service Management System

## Overview
A full-stack car service management web application for Skoda service centers with role-based dashboards.

## Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (via DATABASE_URL)
- **Auth**: express-session (session-based, not JWT)

## Roles & Dashboards
| Role | Path | Description |
|------|------|-------------|
| Receptionist | /dashboard | Vehicle entry (Walk-in + Excel import), appointment list |
| Service Adviser | /adviser | Job assignment, delivery confirmation, reopen with reason |
| Job Controller | /controller | Technician reallocation, overview |
| Technician | /technician | Timer-based work tracking, parts wait tracking |
| Customer | — | Public vehicle tracker |

## Key Features
- **Walk-in form**: Job card (optional, auto-generated), customer, vehicle number, model (dropdown), service adviser (dropdown), service order type
- **Excel import**: Upload `.xlsx` file, header row selector (handles extra header rows), duplicate detection, import summary
  - Columns: Appointment Time, SSD No, Service Advisor Name, Service Order Type, Sell-to Customer Name, License No., Model
  - Appointment time stored as-is (text, no conversion)
  - Job card = null on import; generated when vehicle arrives via "Receive Vehicle"
  - Imported status = "Today's Appointment"; Walk-in status = "Walk-in"
- **Receive Vehicle**: Receptionist clicks button on appointment → status = "Waiting for Adviser" + auto job card (RCV-{timestamp})
- **Today-only default view**: Dashboard shows only today's vehicles; "View History" toggle for historical records with date filter
- **Mobile responsive**: Card layout on mobile, table layout on desktop
- **Technician timer**: Accurate `Date.now()`-based start/pause/resume; parts wait time dialog
- **Parts wait tracking**: Records elapsed time when entering wait, stores duration
- **Adviser dashboard**: "Waiting for Adviser" vehicles in pending list; confirm delivery; reopen with mandatory reason
- **All dashboards**: Search by vehicle/job card/customer + date filter

## Job Controller → Technician Workflow
- **Trigger**: Vehicle becomes "Waiting for Job Allocation" after adviser completes inspection
- **Controller assigns**: Opens "Assign Technician" dialog showing vehicle details, inspection notes, and each customer complaint as a separate row — each complaint gets its own technician + estimated time
- **Multi-tech assignment**: Different complaints can be routed to different technicians; stored as JSON in `complaintAssignments` column
- **After assignment**: Vehicle status → "Work in Progress"; each technician's dashboard automatically shows their assigned vehicle with only their specific complaints and estimated times
- **Job Stopped**: Technician can stop a job with a reason; status → "Job Stopped"; controller sees it in "Job Stoppage" tab and can reassign
- **Reopened Jobs**: When adviser reopens a job, status → "Reopened"; controller must reassign via "Reopened Jobs" tab; technicians do NOT see "Reopened" status directly
- **Job History**: Stored as JSON in `jobHistory` column; each technician's assignment/stop/completion is tracked separately; shown as per-technician cards in controller dashboard

## Adviser Dashboard Tabs
Pending Inspection → Waiting for Job Allocation → Work in Progress → **Job Stopped** → Pending Final Inspection → Reopened → Delivered → History

## Controller Dashboard Tabs
Needs Assignment | Job Stoppage | **Reopened Jobs** | Assigned / History

## Data Model (vehicles table)
Notable fields: `jobCardNumber`, `customerName`, `phone`, `vehicleNumber`, `vehicleModel`, `serviceAdviser`, `serviceOrderType`, `entryType` (Walk-in / Today's Appointment), `appointmentTime`, `ssdNo`, `priority`, `status`, `technicianId`, `complaints` (JSON array of complaint strings), `complaintAssignments` (JSON array of `{complaint, technicianId, estimatedTime}` objects), `serviceNotes`, `totalWorkDuration`, `partsWaitDuration`, `reopenReason`

## Dropdowns
- **Service Advisers**: NASIYA NAUSHAD, ANJALI PT, JITHIN G NAIR, MUHAMMAD HAFIZ, MANU JOSEPH MARTIN, MIDHUN SATYA, MINHAJ BIN JABIR M V, SUDHIN K, YADHU KRISHNA
- **Service Order Types**: ACC REP, BS FR, FFS-KUS, PAID SER, PRE-DELINS, RR, SCH, INS-SER, SER
- **Vehicle Models**: SLAVIA, KUSHAQ, KODIAQ, KAROQ, KYLAQ, SUPERB, OCTAVIA, LAURA, YETI, RAPID

## File Structure
```
shared/schema.ts       - Drizzle schema + Zod types
server/storage.ts      - IStorage interface + DatabaseStorage
server/routes.ts       - Express API routes
server/seed.ts         - DB seed (only if no technicians)
client/src/
  pages/               - Dashboard pages per role
  components/          - Shared UI (StatusBadge, layout)
  hooks/               - use-vehicles, use-auth, use-users
```
