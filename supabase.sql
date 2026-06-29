create table if not exists archive_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table archive_state enable row level security;

drop policy if exists "public archive read" on archive_state;
create policy "public archive read"
on archive_state for select
using (true);

drop policy if exists "public archive write" on archive_state;
create policy "public archive write"
on archive_state for insert
with check (true);

drop policy if exists "public archive update" on archive_state;
create policy "public archive update"
on archive_state for update
using (true)
with check (true);

create table if not exists archive_shares (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table archive_shares enable row level security;

drop policy if exists "public share read" on archive_shares;
create policy "public share read"
on archive_shares for select
to anon, authenticated
using (true);

drop policy if exists "public share create" on archive_shares;
create policy "public share create"
on archive_shares for insert
to anon, authenticated
with check (true);

grant select, insert on archive_shares to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('documentation-images', 'documentation-images', true)
on conflict (id) do nothing;

drop policy if exists "public image read" on storage.objects;
create policy "public image read"
on storage.objects for select
using (bucket_id = 'documentation-images');

drop policy if exists "public image upload" on storage.objects;
create policy "public image upload"
on storage.objects for insert
with check (bucket_id = 'documentation-images');
