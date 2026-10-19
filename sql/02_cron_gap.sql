-- Cron jobs run INSIDE the database. They do not run while it is down, so a gap in the run history is a rough measure of the downtime.
-- Run history of the last 30 minutes (Japan time). Run this after the restart.
-- For a job that runs every 10 seconds, a large jump between rows is the restart gap.
select to_char(start_time at time zone 'Asia/Tokyo', 'HH24:MI:SS') as started_jst, status
from cron.job_run_details
where start_time > now() - interval '30 minutes'
order by start_time;
