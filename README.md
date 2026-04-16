# GMAX Studio Management System

## Overview
GMAX Studio Management System is a comprehensive web-based platform tailored for high-volume photography studios. It eliminates the inefficiencies of manual logbooks by providing real-time booking conflict detection, automated payment tracking, secure client photo delivery, and automated communication. 

This document serves as a clean architectural specification and blueprint for generating or understanding the project.

---

## 🛠 Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling UI**: Tailwind CSS, shadcn/ui, Lucide React
- **Authentication**: Better Auth - Credentials Provider
- **Database**: Superbase
- **File Storage**: Cloudflare R2 (S3-Compatible)
- **Integrations**: Paystack (Payments), Termii API (SMS), Google Calendar API

---

## 👥 User Roles & Access Control

The application enforces strict Role-Based Access Control (RBAC) to ensure operational security.

1. **Admin**: Full system access. Can manage staff roles, access high-level financial metrics, configure service pricing, and modify studio settings.
2. **Manager**: Oversees daily operations. Has CRUD access for clients, bookings, and payments. Can assign staff to bookings but cannot alter system configurations.
3. **Receptionist**: Front-desk operations. Creates new client profiles, logs bookings, records manual payments, and checks the calendar for scheduling conflicts.
4. **Photographer**: Assigned to specific shoots. Views upcoming assignments, client notes, and uploads raw/final photos to the delivery system.
5. **Videographer**: Similar to the Photographer role, but tailored for video assignments.
6. **Photo Editor / Video Editor**: Post-production staff. Receives notifications when shoots are complete, downloads assets, and uploads the finalized edits for client delivery.
7. **Staff**: Base role for generic personnel with read-only capabilities for necessary operational data.

---

## 🚀 Core Features & Modules (Detailed Breakdown)

### 1. Advanced Client Management System (CRM)
- **Profile Management:** Full CRUD operations for detailed client profiles (Name, Phone, Email, Address, Notes). Contains Nigerian-format phone validation hooks.
- **Classification & Tagging:** Dynamic tagging system to categorize clients automatically (VIP, Corporate, Standard, VVIP) to prioritize high-value profiles.
- **Aggregated History:** Direct insight into every client’s entire chronological journey, including past shoots attended, payment consistency (reliability of initial deposits vs. full completions), and cumulative lifetime value calculations.
- **Search & Filtering:** Real-time lookup enabling receptionists to filter clients globally by phone numbers or full names.

### 2. Intelligent Booking & Calendar System
- **Real-Time Conflict Prevention Algorithm:** The backend ensures no two sessions overlap. It automatically calculates availability and enforces a strict 2-hour separation buffer between bookings before confirming DB insertion.
- **Custom Time-Picker Component:** Specifically built popover interface allowing clients/receptionists to book at accurate 45-minute intervals tailored specifically to standard studio shoot structures. 
- **Dynamic Pricing "Snapshots":** When a user selects a service package (e.g., Wedding Photography + Extra Prints), the system saves a direct snapshot of the price to a pivot table (`BookingItem`). If the studio updates package prices later, historical booking balances remain untouched.
- **Resource Allocation:** Managers can directly assign a specific Photographer or Videographer to a booking, routing that shoot directly to the assigned staff member's personal dashboard view.
- **Google Calendar Synchronization:** One-way automated synchronization pushes confirmed bookings directly to the studio's Google Calendar via OAuth 2.0 without redundant manual entry.

### 3. Comprehensive Payment Tracking & Security
- **Multi-Method Ledger:** Supports and organizes records for sequential payments (e.g. initial deposits, partial balance completions, final sweeps) across Cash, Bank Transfer, POS, and Paystack.
- **Paystack Webhook Verification:** Online payments are confirmed strictly via backend webhook responses rather than client-side assertions, severely limiting vulnerability to falsified payment receipts.
- **Overdue Alert System:** A visual, dashboard-level warning system highlights bookings missing final payments in red, preventing unpaid deliverables from slipping under the radar.
- **Receipt Engine:** Automatic generation of structured receipt tracking numbers and unique reference codes for every verified transaction.

### 4. Payment-Gated Photo Delivery System 
- **Bulk Media Handling:** Provides staff with drag-and-drop capability enabling direct, heavy uploads into Cloudflare R2 (bypassing the internal server for speed and reducing egress latency). Triggers automatic thumbnail generation for fast page loads.
- **The "Payment Gate" Mechanism:** The core studio revenue protection feature. The file download system actively checks the booking's `paymentStatus`. R2 payload URLs remain locked and un-generated until the central system registers the balance as `COMPLETED`. 
- **Secure Token URLs:** Every completed shoot generates a cryptographically secure, unique identifier (`DeliveryToken`) that serves as the isolated access point to the digital files via a public client portal.
- **Automated Lifecycle Policy:** To optimize cloud storage costs, download portals expire and assets are permanently scrubbed from R2 buckets exactly 7 days after the link generates. (Warning notifications are dispatched 3 days prior).

### 5. Automated Communications & Notifications
- **Termii API Integration (SMS):** Automated text triggers generated by background jobs fire instantly for:
  - Immediate Booking Confirmations.
  - 3-Day Upcoming Payment Balance Reminders.
  - 1-Day Urgent Payment Warnings.
  - "Photos are Ready for Download" Alerts.
- **WhatsApp Quick Links:** Dynamic link generation allowing staff to securely transition conversations manually into WhatsApp using pre-filled API templates referencing the client's name and Booking ID.
- **Analytics Dashboard (Bonus):** Summarizes the raw CRM data visually through responsive Recharts, showing current month expected revenues vs. collected revenues, booking type distributions, and a visual heatmap of the busiest scheduling days.

---

## 🗄️ Database Architecture (Key Entities)

- **`Staff`**: Stores credentials, role enums, and studio assignments. Controls system access.
- **`Client`**: Stores customer contact details, tags, and relational links to their history.
- **`Booking`**: The central entity representing a scheduled shoot. Links to a `Client`, assigned `Staff` (photographer), and tracks states (`CONFIRMED`, `COMPLETED`, `CANCELLED`).
- **`BookingItem` & `Service`**: Maps specific offerings (e.g., Wedding Photography, Portraits) and locks in pricing at the moment of booking creation.
- **`Payment`**: Records transactions, amounts, and payment methods tied to a specific `Booking`.
- **`Photo` & `DeliveryToken`**: Maps R2 storage bucket keys and manages secure access tokens for client deliverables.

---

## 🤖 Implementation Guide (For AI Generation)

To automatically scaffold and build this project using AI tools, follow these structured steps:

1. **Bootstrap Phase**: 
   Initialize Next.js 16 with Tailwind CSS, TypeScript, and shadcn/ui. Set up proper routing conventions.
2. **Database & Auth Schema**: 
   Configure Prisma with PostgreSQL. Generate the schemas for the entities listed above (Staff, Client, Booking, Service, Payment). Integrate Auth.js using the `Staff` table.
3. **Core APIs**: 
   Create Next.js Route Handlers (`/api/clients`, `/api/bookings`, `/api/services`) to enable standard CRUD operations. Implement the conflict detection algorithm in the `POST /api/bookings` route.
4. **Frontend Architecture**: 
   Build the Admin Dashboard utilizing a collapsible sidebar. Implement the Client list pages, the interactive Calendar View, and the Custom Time Picker component.
5. **Payment & Storage Logic**: 
   Layer the financial logic to calculate outstanding balances. Integrate S3-compatible endpoints to manage Cloudflare R2 uploads, tying photo access strictly to the "paid in full" status.
6. **Refinement**: 
   Finalize data visualization with Recharts on the home dashboard, and wire up SMS notifications for booking lifestyle events.
