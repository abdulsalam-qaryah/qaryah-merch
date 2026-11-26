-- ============================================================
-- الإصدار 14: خصوصية الفروع + طلبات شراء المناديب + الإشعارات + التحدي اليومي
-- شغّله مرة وحدة من: SQL Editor ← New query ← Run (آمن لو تكرر). يحتاج 1_schema.sql قبله.
--
-- المندوب: يشوف فروعه فقط، وتقاريره، وطلبات الشراء والرحلات اللي على فروعه، وإشعاراته.
--          ما يعرف عن الفروع الثانية ولا تقارير زملائه.
-- المشرف والمدير: يشوفون كل شيء.
-- التحدي اليومي (pricewatch): أول مندوب يسجل البراند في اليوم يقفله، ولا أحد يقدر يكتب فوقه
--          (التعديل والحذف للمدير فقط).
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

-- هل الفرع مربوط بالمستخدم الحالي؟
create or replace function public.my_branch(bid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.docs
    where collection = 'branches' and id = bid and data->>'merchUid' = auth.uid()::text
  );
$$;
grant execute on function public.my_branch(text) to authenticated;

-- هل في الرحلة وقفة على فرع من فروع المستخدم؟
create or replace function public.my_trip(stops jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(stops, '[]'::jsonb)) s
    where public.my_branch(s->>'branchId')
  );
$$;
grant execute on function public.my_trip(jsonb) to authenticated;

-- ---------- القراءة ----------
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  public.is_supervisor()
  or collection = 'settings'
  or (collection in ('profiles', 'roles') and (id = auth.uid()::text or public.is_approved()))
  or (public.is_approved() and (
       collection in ('regions', 'trucks', 'pricewatch')
    or (collection = 'branches' and data->>'merchUid' = auth.uid()::text)
    or (collection in ('reports', 'followups', 'reviews') and data->>'uid' = auth.uid()::text)
    or (collection = 'notifs' and data->>'to' = auth.uid()::text)
    or (collection = 'pos' and (data->>'createdBy' = auth.uid()::text or public.my_branch(data->>'branchId')))
    or (collection = 'trips' and public.my_trip(data->'stops'))
  ))
);

-- ---------- الإضافة ----------
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_supervisor() and collection in ('followups', 'pos', 'trips', 'reviews', 'notifs'))
  or (public.is_approved() and collection = 'pos' and public.my_branch(data->>'branchId')
      and coalesce(data->>'status', 'pending') in ('pending', 'delivered', 'partial'))
  or (public.is_approved() and collection = 'pricewatch' and data->>'uid' = auth.uid()::text
      and public.my_branch(data->>'branchId'))
);

-- ---------- التعديل ----------
-- ملاحظة: upsert على براند مقفول يحتاج صلاحية تعديل، فيُرفض للمندوب = القفل.
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_supervisor() and collection in ('reports', 'followups', 'pos', 'trips', 'reviews', 'notifs'))
  or (public.is_approved() and collection = 'pos' and public.my_branch(data->>'branchId'))
  or (public.is_approved() and collection = 'trips' and public.my_trip(data->'stops'))
  or (public.is_approved() and collection = 'notifs' and data->>'to' = auth.uid()::text)
) with check (
  public.is_admin()
  or (collection = 'profiles' and id = auth.uid()::text)
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_supervisor() and collection in ('reports', 'followups', 'pos', 'trips', 'reviews', 'notifs'))
  or (public.is_approved() and collection = 'pos' and public.my_branch(data->>'branchId')
      and coalesce(data->>'status', 'pending') in ('pending', 'delivered', 'partial'))
  or (public.is_approved() and collection = 'trips' and public.my_trip(data->'stops'))
  or (public.is_approved() and collection = 'notifs' and data->>'to' = auth.uid()::text)
);

-- ---------- الحذف ----------
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_admin()
  or (public.is_approved() and collection = 'reports' and data->>'uid' = auth.uid()::text)
  or (public.is_supervisor() and collection in ('followups', 'pos', 'trips', 'reviews', 'notifs'))
  or (public.is_approved() and collection = 'pos' and public.my_branch(data->>'branchId')
      and coalesce(data->>'status', 'pending') in ('pending', 'returned'))
);

create index if not exists docs_pricewatch_date_idx on public.docs ((data->>'date')) where collection = 'pricewatch';
create index if not exists docs_notifs_to_idx on public.docs ((data->>'to')) where collection = 'notifs';
create index if not exists docs_notifs_date_idx on public.docs ((data->>'date')) where collection = 'notifs';
create index if not exists docs_branches_merch_idx on public.docs ((data->>'merchUid')) where collection = 'branches';
