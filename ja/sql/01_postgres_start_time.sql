-- Postgresがいつ起動したか（再起動したかどうか）をデータベース自身に聞く
select pg_postmaster_start_time() as postgres_started_at, now() as checked_at;
