# Thesis Workflow V2 — Smoke Tests

Manual runbook for verifying the institutional thesis workflow end-to-end after deploy. Walk through these in order against a non-production environment first, then production once green.

**Prerequisites**
- Migrations `20260524000005`..`20260524000009` applied (see `supabase migration list`)
- `CRON_SECRET` set in Vercel for `production`, `preview`, `development`
- `THESIS_WORKFLOW_V2` flag = `true` in `src/lib/flags.ts`
- Two test accounts: one student, one supervisor; both members of the same institution; supervisor has `available_to_supervise = true` and `supervision_max_students = 3` (or similar)

---

## 1. Policy snapshot on thesis creation

**Steps:**
1. Sign in as an `admin` or `coordinator` at the institution.
2. Open `/settings` → "Institution administration" card → click "Thesis policy".
3. Toggle `Require approved ethics gate` to ON. Save.
4. Confirm toast: "Saved — policy is now v2" (or higher).
5. Sign in as the student. Go to `/projects/new-thesis` and create a thesis.

**Expected:**
- New `thesis_metadata` row has `lifecycle_state = 'matched'`, `policy_version_snapshot = 2`, and `policy_snapshot` JSON contains `require_ethics_gate: true`.
- Verify in Supabase Studio: `select project_id, lifecycle_state, policy_version_snapshot, policy_snapshot->>'require_ethics_gate' from thesis_metadata order by created_at desc limit 1;`

---

## 2. Capacity guard

**Steps:**
1. Set the test supervisor's `supervision_max_students = 1`.
2. Have student A successfully request that supervisor (accept the request as the supervisor).
3. Sign in as a second student. Open `/student/supervisor` → "Find a supervisor" → search for them.

**Expected:**
- Supervisor card shows `Full` badge, greyed out, Request button disabled.
- If the badge mechanism is bypassed via DevTools, the POST to `/api/supervisor/request` returns `409 { code: 'capacity_full' }`.

---

## 3. Chapter revision loop

**Steps:**
1. As the student, open the thesis chapters page. Click "Start Writing" on chapter 1 → editor opens.
2. Save some content. Return to chapters page.
3. Click "Submit for Review" → confirm.
4. As the supervisor, open `/supervisor/projects/[id]/documents/[docId]` for that chapter's document.
5. Confirm the amber "Awaiting your review" banner is visible above the editor.
6. Click "Add feedback", type "Try expanding section 2.", click "Request revisions".
7. Confirm chapter status flips to `revision_requested` on the student side.
8. Student clicks "Resubmit" → repeat with "Approve" this time.

**Expected:**
- `thesis_chapter_submissions` has 2 rows: round=1 (decision=revision_requested), round=2 (decision=approved).
- The History drawer on the chapter card shows both rounds with feedback.
- Notifications fire to both parties at each step.

---

## 4. State machine + permissions

**Steps:**
1. As the student on the chapters page, expand the "Workflow State" panel.
2. Verify current state chip reads `Matched` (or `Proposal draft` if you already submitted).
3. As the student, attempt to transition `Proposal review → Active` — the button should NOT appear (it's the supervisor's edge).
4. Sign in as the supervisor. Open the same project. The Workflow State panel should offer `Approve proposal → Active`.
5. Click it.

**Expected:**
- Transition succeeds. State chip flips to `Active`.
- If the institution policy `require_ethics_gate = true` and no ethics gate is approved, the API returns `400` with `code: 'ethics_gate_required'` and a clear error toast.

---

## 5. State machine guard (DB layer)

**Steps:**
1. In Supabase SQL editor, attempt to bypass the API: `update thesis_metadata set lifecycle_state = 'archived' where project_id = '<test_thesis>';`

**Expected:**
- `ERROR: Illegal thesis transition: ... by role system` (or `check_violation`).
- The trigger rejects the transition because the actor role is `system` and the from→to edge requires `coordinator`/`admin`.

---

## 6. Deadlines + reminders

**Steps:**
1. As the student, set a chapter's `target_date` to **2 days from now**.
2. Verify a row appears in `deadlines` (kind=`chapter_due`, owner_id=student).
3. As an admin, trigger the sweep manually:
   ```bash
   curl -X POST -H "Cookie: $(your_session_cookie)" https://your-app/api/admin/deadline-sweep
   ```
4. Check `deadline_reminders` — one row should exist with `offset_label = '2d'`.
5. Confirm the student received an email + in-app notification.
6. Re-run the sweep — `deadline_reminders` unchanged (idempotent).

**Expected:**
- Single reminder per (deadline, offset, recipient). Second sweep is a no-op for that row.
- Audit log shows `thesis.deadline.reminder_sent` entry.

---

## 7. Cron route auth

**Steps:**
1. Unauthenticated: `curl https://your-app/api/cron/deadline-sweep` → expect `401`.
2. Wrong secret: `curl -H "Authorization: Bearer wrong" https://your-app/api/cron/deadline-sweep` → expect `401`.
3. Correct: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/deadline-sweep` → expect JSON `{ scanned, reminders_sent, escalations_sent, errors, duration_ms }`.

---

## 8. Escalation

**Steps:**
1. Manually set a deadline's `target_at` to **2 days ago** (so the escalation window has passed): `update deadlines set target_at = now() - interval '2 days' where id = '<deadline_id>';`
2. Trigger sweep.

**Expected:**
- Every coordinator/admin in the workspace receives `deadline_escalation` notification + email.
- `deadline_reminders` has `offset_label = 'escalation'` rows for each recipient.
- Audit log has `thesis.deadline.escalated` entry.

---

## 9. Audit timeline UI

**Steps:**
1. Open the chapters page for a thesis that's been through some workflow events.
2. Scroll to "Workflow Timeline" card.

**Expected:**
- Entries grouped by Today / Yesterday / dates.
- Each entry shows actor name, action label, timestamp.
- "Details" expand reveals the raw `details` JSON.
- Only `thesis.*`, `supervisor.assignment.*`, `supervisor.capacity.*` events appear (not unrelated dataset/analysis events).

---

## 10. Feature flag kill-switch

**Steps:**
1. Set `THESIS_WORKFLOW_V2 = false` in `src/lib/flags.ts` and redeploy.

**Expected:**
- Workflow State panel + Workflow Timeline card disappear from the chapters page.
- History drawer on ChapterCard disappears.
- Chapter Decision banner doesn't appear in supervisor document viewer.
- `/settings/institution/thesis-policy` redirects to `/settings`.
- "Institution administration" card hidden from `/settings`.
- API routes still work (cron sweep keeps running, deadlines still accrue, audit chain continues). Backend state is preserved for re-enable.

---

## Pass / fail criteria

A green smoke-test pass = all 10 sections complete without:
- 500 errors in the browser network tab
- Unhandled exceptions in `vercel logs`
- Audit gaps (every visible state change has a matching `audit_logs` entry)
- Stuck transactions (deadline reminders re-firing on consecutive sweeps)

If anything fails, capture the request/response in the network tab and the corresponding Supabase function logs before iterating.
