-- ============================================================
-- متابعة المناديب – القرية · إعداد قاعدة البيانات (Supabase)
-- شغّل هذا الملف مرة وحدة من: SQL Editor ← New query ← Run
-- ============================================================

-- 1) اسم مستخدم المدير: أول من يسجّل بهذا الاسم يصير مدير النظام.
--    غيّر 'admin' لاسم المستخدم اللي تبغاه (إنجليزي صغير بدون مسافات) قبل التشغيل.
create table if not exists public.admin_usernames (username text primary key);
insert into public.admin_usernames(username) values ('admin') on conflict do nothing;

-- 2) الجداول
create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);
create index if not exists docs_collection_idx on public.docs (collection);
create index if not exists docs_reports_date_idx on public.docs ((data->>'date')) where collection = 'reports';
create index if not exists docs_reports_uid_idx on public.docs ((data->>'uid')) where collection = 'reports';

create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

alter table public.docs enable row level security;
alter table public.admins enable row level security;
alter table public.admin_usernames enable row level security;

-- 3) دوال الصلاحيات
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.docs
    where collection = 'roles' and id = auth.uid()::text and coalesce((data->>'approved')::boolean, false)
  );
$$;

-- تحديث جزئي لمستند (يحترم الصلاحيات لأنه security invoker)
create or replace function public.doc_merge(c text, i text, patch jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.docs set data = data || patch, updated_at = now(), updated_by = auth.uid()
  where collection = c and id = i;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- 4) المدير يُعيَّن تلقائياً عند التسجيل باسم المستخدم المحدد فوق
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admin_usernames where username = lower(split_part(new.email, '@', 1))) then
    insert into public.admins(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) سياسات الوصول
--   قراءة: الموظف المعتمد يقرأ كل شيء. غير المعتمد يقرأ ملفه ودوره فقط.
--   كتابة: المدير يكتب كل شيء. المعتمد يكتب تقاريره، والمتابعة، وطلبات الشراء، والرحلات.
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  public.is_approved()
  or collection = 'settings'
  or (collection in ('profiles', 'roles') and id = auth.uid()::text)
);

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
) with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_admin()
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
);

-- 5ب) صلاحيات الوصول من التطبيق (Data API) حتى لو كان خيار «Grant API access» غير مفعّل
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;

-- 6) التحديث المباشر (Realtime)
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 7) تخزين صور الرفوف
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and public.is_approved() and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated using (bucket_id = 'photos');
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
