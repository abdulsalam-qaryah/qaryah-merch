-- ============================================================
-- الحضور واللبس الرسمي والحوافز (إصدار 13)
-- شغّله مرة وحدة من: SQL Editor ← New query ← Run (آمن لو تكرر)
-- يسمح لمشرف المنطقة يعتمد اللبس ويسجّل الأعذار في مجموعة reviews.
-- المدير يقدر من غير هذا الملف. صور بداية ونهاية الدوام تنحفظ داخل تقرير المندوب نفسه.
-- ============================================================

create or replace function public.is_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.docs
    where collection = 'roles' and id = auth.uid()::text
      and coalesce((data->>'approved')::boolean, false) and data->>'role' = 'supervisor'
  );
$$;
grant execute on function public.is_supervisor() to authenticated;

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
  or (public.is_supervisor() and collection = 'reviews')
);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
  or (public.is_supervisor() and collection = 'reviews')
) with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
  or (public.is_supervisor() and collection = 'reviews')
);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_admin()
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_approved() and collection in ('followups', 'pos', 'trips'))
  or (public.is_supervisor() and collection = 'reviews')
);

create index if not exists docs_reviews_date_idx on public.docs ((data->>'date')) where collection = 'reviews';
