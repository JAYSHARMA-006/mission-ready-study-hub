-- ============ Officer Path Academy core schema ============

create type public.app_role as enum ('admin');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  account_status text not null default 'active' check (account_status in ('active','disabled'))
);

-- ---------- user_roles (never on profile) ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

-- ---------- exam categories ----------
create table public.exam_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- folders (nested) ----------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  parent_folder_id uuid references public.folders(id) on delete cascade,
  exam_category_id uuid references public.exam_categories(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- study materials ----------
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  storage_path text not null,
  original_file_name text not null default '',
  file_type text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  folder_id uuid references public.folders(id) on delete set null,
  exam_category_id uuid references public.exam_categories(id) on delete set null,
  subject text not null default '',
  topic text not null default '',
  publication_status text not null default 'draft' check (publication_status in ('published','draft')),
  download_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- downloads ----------
create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  study_material_id uuid not null references public.study_materials(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

-- ---------- contact messages ----------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null default '',
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

-- ---------- indexes ----------
create index idx_folders_parent on public.folders(parent_folder_id);
create index idx_folders_category on public.folders(exam_category_id);
create index idx_materials_folder on public.study_materials(folder_id);
create index idx_materials_category on public.study_materials(exam_category_id);
create index idx_materials_status on public.study_materials(publication_status);
create index idx_downloads_student on public.downloads(student_id);
create index idx_downloads_material on public.downloads(study_material_id);

-- ---------- updated_at triggers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_folders_updated before update on public.folders
for each row execute function public.set_updated_at();
create trigger trg_materials_updated before update on public.study_materials
for each row execute function public.set_updated_at();

-- ---------- role check (security definer, avoids RLS recursion) ----------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- does any admin exist yet (drives first-time admin setup)
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;

-- ---------- auto profile on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1), 'Cadet'),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- record a download atomically ----------
create or replace function public.record_download(_material_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select account_status into v_profile from public.profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Profile not found';
  end if;
  if v_profile <> 'active' then
    raise exception 'Your account access has been disabled. Contact the academy admin.';
  end if;

  select publication_status into v_status from public.study_materials where id = _material_id;
  if v_status is null then
    raise exception 'Study material not found';
  end if;
  if v_status <> 'published' then
    raise exception 'This material is not published';
  end if;

  insert into public.downloads (student_id, study_material_id)
  values (auth.uid(), _material_id);

  update public.study_materials
  set download_count = download_count + 1
  where id = _material_id;
end $$;

-- ---------- GRANTS ----------
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select on public.exam_categories to anon, authenticated;
grant all on public.exam_categories to service_role;

grant select on public.folders to anon, authenticated;
grant all on public.folders to service_role;

grant select on public.study_materials to anon, authenticated;
grant all on public.study_materials to service_role;

grant select, insert on public.downloads to authenticated;
grant all on public.downloads to service_role;

grant select, insert on public.contact_messages to anon;
grant all on public.contact_messages to service_role;

grant execute on function public.record_download(uuid) to authenticated;
grant execute on function public.admin_exists() to anon, authenticated;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.exam_categories enable row level security;
alter table public.folders enable row level security;
alter table public.study_materials enable row level security;
alter table public.downloads enable row level security;
alter table public.contact_messages enable row level security;

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "profiles: update own limited columns"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "user_roles: read own"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "exam categories: public read"
  on public.exam_categories for select to anon, authenticated
  using (true);

create policy "folders: public read"
  on public.folders for select to anon, authenticated
  using (true);

create policy "materials: published public, admin all"
  on public.study_materials for select to anon, authenticated
  using (publication_status = 'published' or public.has_role(auth.uid(), 'admin'));

create policy "downloads: read own or admin"
  on public.downloads for select to authenticated
  using (auth.uid() = student_id or public.has_role(auth.uid(), 'admin'));

create policy "downloads: insert own"
  on public.downloads for insert to authenticated
  with check (auth.uid() = student_id);

create policy "contact: anonymous insert"
  on public.contact_messages for insert to anon
  with check (true);

create policy "contact: admin read"
  on public.contact_messages for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "contact: admin update"
  on public.contact_messages for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant update on public.contact_messages to authenticated;

-- ---------- storage policies (private bucket 'study-materials') ----------
create policy "storage: admin uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'study-materials' and public.has_role(auth.uid(), 'admin'));

create policy "storage: admin updates"
  on storage.objects for update to authenticated
  using (bucket_id = 'study-materials' and public.has_role(auth.uid(), 'admin'));

create policy "storage: admin deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'study-materials' and public.has_role(auth.uid(), 'admin'));

create policy "storage: admin reads"
  on storage.objects for select to authenticated
  using (bucket_id = 'study-materials' and public.has_role(auth.uid(), 'admin'));

-- ---------- seed exam categories ----------
insert into public.exam_categories (name, slug, description, display_order) values
  ('NDA / NA', 'nda-na', 'National Defence Academy & Naval Academy — Mathematics and General Ability Test preparation.', 1),
  ('CDS', 'cds', 'Combined Defence Services — English, General Knowledge and Elementary Mathematics.', 2),
  ('AFCAT', 'afcat', 'Air Force Common Admission Test — English, General Awareness, Numerical Ability and Reasoning.', 3),
  ('Agniveer Vayu', 'agniveer-vayu', 'Indian Air Force Agniveer Vayu intake — Science, Mathematics, English and GK.', 4),
  ('CAPF', 'capf', 'Central Armed Police Forces Assistant Commandant — Paper I and Paper II preparation.', 5),
  ('Other Defence Exams', 'other-defence', 'Indian Coast Guard, Territorial Army, INET and other defence entry exams.', 6);
