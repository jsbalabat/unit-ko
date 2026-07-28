-- The hot read path for the activity feed is
--   where user_id = <landlord> order by created_at desc
-- (ActivityRepository.findByLandlord). Only property_id and created_at were
-- indexed, so every feed load scanned by user_id. Composite so one index serves
-- both the landlord filter and the newest-first sort.

create index idx_activity_logs_user
  on public.activity_logs (user_id, created_at desc);
