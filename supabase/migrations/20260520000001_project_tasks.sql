-- Personal tasks scoped to a project + user
-- Separate from supervisor-set student_milestones

create table if not exists project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  text        text not null check (char_length(text) > 0),
  due_date    date null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index project_tasks_project_user_idx on project_tasks(project_id, user_id);

alter table project_tasks enable row level security;

-- Users can only see and manage their own tasks
create policy "owner_all" on project_tasks
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
