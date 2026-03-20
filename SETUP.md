# PLEXUS Research Lab — Setup Guide

## Prerequisites

- Node.js 18+
- Supabase project
- Vercel account (for deployment)

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup

Run the migrations in order in your Supabase SQL editor:

1. `supabase/migrations/001_initial_schema.sql` — Core tables (profiles, projects, documents, ethics)
2. `supabase/migrations/003_reviews_notifications.sql` — Phase 3 tables (reviews, comments, approval gates, notifications)

## Development

```bash
npm install
npm run dev
```

## Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

## Supabase Configuration

### Enable Realtime

In your Supabase dashboard, enable Realtime for:
- `notifications` table (for real-time notification delivery)
- `review_requests` table (for live queue updates)

### Auth Settings

- Enable email/password auth
- Set your site URL and redirect URLs to your Vercel deployment URL

## Phase 3 Features

### Real-Time Collaboration
- TipTap editor with Yjs CRDT for conflict-free editing
- Supabase Realtime Broadcast as WebSocket transport for Yjs sync messages
- Live colored cursors showing other users' positions
- Online users panel showing connected editors

### Review Workflow
- Submit documents for supervisor review with priority and due date
- Two-panel review queue (queue left, workspace right)
- Supervisor can add section comments, overall feedback
- Approve / Request Revision / Reject actions
- Automatic notifications for all review events

### Approval Gates
- Create milestone gates on projects
- Supervisors/admins can approve or block gates
- Real-time notifications when gates are approved

### Notifications
- Bell icon in header with unread count badge
- Real-time delivery via Supabase Realtime postgres_changes subscription
- Full notification center at `/notifications`
- Toast-style alerts for new notifications

## User Roles

- **researcher** — Can create projects/documents, submit for review
- **supervisor** — Can review documents, approve/reject, manage gates
- **admin** — Full access to all features
