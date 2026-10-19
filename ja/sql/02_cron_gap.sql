-- cronジョブは、データベースの「中」で動く。止まっている間は実行されないので、実行履歴の空白が「止まっていた時間」の目安になる。
-- 直近30分の実行履歴（日本時間）。再起動のあとに実行してください。
-- 10秒ごとのジョブなのに、間隔が大きく空いている所が、再起動の空白です。
select to_char(start_time at time zone 'Asia/Tokyo', 'HH24:MI:SS') as started_jst, status
from cron.job_run_details
where start_time > now() - interval '30 minutes'
order by start_time;
