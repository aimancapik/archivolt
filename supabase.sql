create table if not exists public.archive_state (
  id text primary key,
  owner_id uuid references auth.users(id) on delete restrict,
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.archive_state add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.archive_state add column if not exists revision bigint not null default 0;
alter table public.archive_state enable row level security;

drop policy if exists "public archive read" on public.archive_state;
drop policy if exists "public archive write" on public.archive_state;
drop policy if exists "public archive update" on public.archive_state;
drop policy if exists "owner archive read" on public.archive_state;
drop policy if exists "owner archive create" on public.archive_state;
drop policy if exists "owner archive update" on public.archive_state;

create policy "owner archive read"
on public.archive_state for select
to authenticated
using (id = 'main' and owner_id = auth.uid());

create policy "owner archive create"
on public.archive_state for insert
to authenticated
with check (id = 'main' and owner_id = auth.uid());

create policy "owner archive update"
on public.archive_state for update
to authenticated
using (id = 'main' and owner_id = auth.uid())
with check (id = 'main' and owner_id = auth.uid());

revoke all on public.archive_state from anon;
grant select, insert, update on public.archive_state to authenticated;

create table if not exists public.archive_shares (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.archive_shares add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.archive_shares enable row level security;

drop policy if exists "public share read" on public.archive_shares;
drop policy if exists "public share create" on public.archive_shares;
drop policy if exists "owner share read" on public.archive_shares;
drop policy if exists "owner share create" on public.archive_shares;

create policy "owner share read"
on public.archive_shares for select
to authenticated
using (owner_id = auth.uid());

create policy "owner share create"
on public.archive_shares for insert
to authenticated
with check (owner_id = auth.uid());

revoke all on public.archive_shares from anon;
grant select, insert on public.archive_shares to authenticated;

create or replace function public.claim_archive()
returns table (claimed boolean, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select owner_id into existing_owner
  from public.archive_state
  where id = 'main';

  if existing_owner is not null and existing_owner <> auth.uid() then
    raise exception 'Archive already belongs to another user';
  end if;

  update public.archive_state
  set owner_id = auth.uid()
  where id = 'main' and owner_id is null;

  update public.archive_shares
  set owner_id = auth.uid()
  where owner_id is null;

  return query
  select true, coalesce(a.revision, 0)
  from public.archive_state a
  where a.id = 'main';
end;
$$;

revoke all on function public.claim_archive() from public, anon;
grant execute on function public.claim_archive() to authenticated;

insert into storage.buckets (id, name, public)
values ('documentation-images', 'documentation-images', false)
on conflict (id) do update set public = false;

drop policy if exists "public image read" on storage.objects;
drop policy if exists "public image upload" on storage.objects;
drop policy if exists "owner image read" on storage.objects;
drop policy if exists "owner image create" on storage.objects;
drop policy if exists "owner image update" on storage.objects;
drop policy if exists "owner image delete" on storage.objects;

create policy "owner image read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documentation-images'
  and auth.uid() = (select owner_id from public.archive_state where id = 'main')
);

create policy "owner image create"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documentation-images'
  and auth.uid() = (select owner_id from public.archive_state where id = 'main')
);

create policy "owner image update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'documentation-images'
  and auth.uid() = (select owner_id from public.archive_state where id = 'main')
)
with check (
  bucket_id = 'documentation-images'
  and auth.uid() = (select owner_id from public.archive_state where id = 'main')
);

create policy "owner image delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documentation-images'
  and auth.uid() = (select owner_id from public.archive_state where id = 'main')
);

do $$
begin
  alter publication supabase_realtime add table public.archive_state;
exception
  when duplicate_object then null;
end;
$$;
