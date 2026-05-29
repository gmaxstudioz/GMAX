# GMAX Studio Management System

## 🌟 Overview
**GMAX Studio Management System** is an enterprise-grade, comprehensive web-based platform tailored specifically for high-volume photography and videography studios. It modernizes the entire studio workflow—from client acquisition and bookings to post-production and final asset delivery. 

By eliminating the inefficiencies of manual logbooks and disconnected tools, GMAX provides real-time booking conflict detection, robust multi-installment payment tracking, secure payment-gated media delivery, a digital product store, and an integrated training academy.

---

## 🏗️ Architecture & Technology Stack
Building a project of this scale requires a robust, type-safe, and scalable technology stack:

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling UI**: Tailwind CSS, shadcn/ui, Framer Motion, GSAP, Lucide React
- **Authentication**: Better Auth (Credentials/OAuth Provider)
- **Database ORM**: Prisma
- **Database Engine**: PostgreSQL (Supabase / Local PG)
- **API Layer**: oRPC (Type-safe RPC framework for Next.js)
- **File Storage**: Cloudflare R2 (S3-Compatible Object Storage)
- **Payments**: Paystack Integration (Webhooks & Verifications)
- **Notifications**: Termii API (SMS/WhatsApp)

---

## 👥 User Roles & Access Control
The application enforces strict Role-Based Access Control (RBAC) to ensure operational security across multiple studio branches.

1. **Owner / Developer**: Full administrative and system access. Can create new studios, manage global settings, oversee all financial metrics, and manage high-level staff roles.
2. **Admin**: High-level access for a specific studio. Can configure service pricing, approve price overrides, and manage staff schedules.
3. **Manager**: Oversees daily studio operations. Has CRUD access for clients, bookings, and payments. Can reassign staff to specific bookings.
4. **Receptionist**: Front-desk operations. Creates new client profiles, logs bookings, records manual payments (POS/Cash), and checks the calendar for scheduling conflicts.
5. **Photographer / Videographer**: Assigned to specific shoots. Views upcoming assignments, client notes, and uploads raw/final assets to the delivery system.
6. **Editor**: Post-production staff. Receives notifications when shoots are complete, downloads raw assets, and uploads finalized deliverables for client review.
7. **Staff**: Base role with read-only capabilities for necessary operational data.

---

## 🚀 Core Features & Modules

### 1. Intelligent Booking & Calendar System
- **Real-Time Conflict Prevention**: The backend ensures no two sessions overlap, enforcing separation buffers and capacity limits across different studio rooms/locations.
- **Dynamic Services & Add-ons**: Services support multiple variants (Studio, Outdoor, Both), base prices, max prices, and associated deliverables. Add-ons can be dynamically attached.
- **Pricing Snapshots**: When a booking is created, the system saves a direct snapshot of the price. If package prices change later, historical booking balances remain untouched.
- **Price Approval Workflow**: Managers can override prices, triggering an approval request to Admins before the booking is fully confirmed.

### 2. Client Management (CRM)
- **Profile Management**: Full tracking of client history, contact details, alternative numbers, and special dates (Birthdays, Weddings).
- **Aggregated History**: Insight into every client’s entire chronological journey, lifetime value, and payment consistency.

### 3. Comprehensive Payment Ledger
- **Multi-Installment Support**: Organizes records for sequential payments (Deposits, Half Payments, Full Clearances).
- **Multi-Method Ledger**: Tracks Cash, Bank Transfer, POS, and online Paystack transactions.
- **Webhook Verification**: Online payments are confirmed strictly via backend webhook responses, preventing client-side forgery.

### 4. Payment-Gated Media Delivery
- **R2 Cloud Storage**: Bulk, high-speed multipart uploads directly into Cloudflare R2.
- **The "Payment Gate"**: Core revenue protection. Download links and asset access remain locked until the central system registers the booking balance as `COMPLETED`.
- **Secure Token URLs**: Clients receive unique, cryptographically secure URLs for accessing their finalized galleries.
- **Automated Lifecycle**: Download portals automatically expire 30 days after upload to optimize storage costs.

### 5. Digital Store & Training Academy
- **Product Store**: Integrated digital storefront for selling presets, lookup tables (LUTs), and guides, complete with automated access links post-purchase.
- **GMAX Academy**: A fully featured module to manage physical/online training courses, batches, student enrollments, and tuition tracking.

### 6. Automated Communications
- **Termii Integration**: Automated SMS triggers for Booking Confirmations, Payment Reminders, and "Photos Ready" alerts.
- **Task Management**: Staff receive dynamic internal notifications and tasks (e.g., "Edit Wedding Video for John Doe") tied directly to booking states.

---

## 🛠️ How to Build & Run Locally

To scaffold and run a project like this, you need the following prerequisites:
- **Node.js**: v18+ 
- **Package Manager**: npm, yarn, or pnpm
- **Database**: A PostgreSQL instance (local or hosted like Supabase)
- **Cloudflare R2**: Access keys for an R2 bucket (or standard AWS S3)
- **Paystack Account**: For payment API keys
- **Termii Account**: For SMS/Notification API keys

### 1. Repository Setup
Clone the repository and install dependencies in the root, `admin`, `api`, and `public` workspaces:
\`\`\`bash
git clone https://github.com/gmaxstudioz/GMAX.git
cd GMAX
npm install
\`\`\`

### 2. Environment Configuration
Create `.env` files in the necessary directories (`/api`, `/admin`, `/public`). Key environment variables include:
- `DATABASE_URL` (PostgreSQL connection string)
- `BETTER_AUTH_SECRET` & `BETTER_AUTH_URL`
- `NEXT_PUBLIC_API_URL`
- `PAYSTACK_SECRET_KEY` & `PAYSTACK_PUBLIC_KEY`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`
- `TERMII_API_KEY` & `TERMII_SENDER_ID`

### 3. Database Migration
Navigate to the API package to push the Prisma schema to your database and generate the client:
\`\`\`bash
cd api
npx prisma db push
npx prisma generate
\`\`\`

### 4. Start the Development Servers
The project is split into multiple frontend applications and a central API. You can start them simultaneously or individually:

**Start the Backend API:**
\`\`\`bash
cd api
npm run dev
\`\`\`

**Start the Admin Dashboard:**
\`\`\`bash
cd admin
npm run dev
\`\`\`

**Start the Public Facing App (Store, Academy, Booking Portal):**
\`\`\`bash
cd public
npm run dev
\`\`\`

### 5. Deployment
- **Database**: Supabase / AWS RDS
- **API**: Vercel, Railway, or Render (Node.js runtime)
- **Admin & Public Apps**: Vercel (Optimized for Next.js 16 App Router)

Make sure to configure the correct CORS origins in the API to allow requests from the deployed Admin and Public domains.
