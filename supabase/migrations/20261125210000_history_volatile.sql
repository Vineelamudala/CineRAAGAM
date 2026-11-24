-- get_my_history applies the midnight rule (an UPDATE) before reading, so it
-- must not be STABLE: the Data API runs STABLE functions in a read-only
-- transaction, where that UPDATE fails.
alter function public.get_my_history(int, int) volatile;
