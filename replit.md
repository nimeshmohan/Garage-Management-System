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
- **Walk-in form**: Job card, customer, vehicle number, model (dropdown), service adviser (dropdown), service order type
- **Excel import**: Upload `.xlsx` file with appointment schedule, preview, duplicate detection, import summary
  - Columns mapped: Appointment Time, SSD No, Service Advisor Name, Service Order Type, Sell-to Customer Name, License No., Model
  - Imported status = "Today's Appointment"; Walk-in status = "Walk-in"
- **Technician timer**: Accurate `Date.now()`-based start/pause/resume; parts wait time dialog
- **Parts wait tracking**: Records elapsed time when entering wait, stores duration
- **Adviser dashboard**: Confirm delivery, reopen with mandatory reason (shown in red)
- **All dashboards**: Search by vehicle/job card/customer + date filter

## Data Model (vehicles table)
Notable fields: `jobCardNumber`, `customerName`, `phone`, `vehicleNumber`, `vehicleModel`, `serviceAdviser`, `serviceOrderType`, `entryType` (Walk-in / Today's Appointment), `appointmentTime`, `ssdNo`, `priority`, `status`, `technicianId`, `totalWorkDuration`, `partsWaitDuration`, `reopenReason`

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
