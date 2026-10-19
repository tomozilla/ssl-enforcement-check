-- （任意）再起動の空白を見るための、10秒ごとのcronジョブ。
-- 他に10秒ごとのジョブが無い場合だけ作ってください。終わったら下の unschedule で消します。
select cron.schedule('ssl-demo-heartbeat', '10 seconds', 'select 1');

-- 後片付け:
-- select cron.unschedule('ssl-demo-heartbeat');
