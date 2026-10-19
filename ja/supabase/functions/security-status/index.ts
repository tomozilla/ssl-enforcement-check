import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

// ステータスページ用のAPI。「この関数からデータベースへの接続は暗号化されているか」「最後にいつ再起動したか」
// 「cronの実行が途切れた時間帯（再起動の空白の目安）」を返します。読み取りだけで、何も書き換えません。
// ※ Verify JWT はオフにして、代わりに「アプリの publishable キーが付いているか」を関数の中で確認します。
//    publishableキーは公開前提のキーなので、これは簡単な入場券です。公開するページには、本物のログインを付けてください。
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);
const PUBLISHABLE_KEYS: string[] = Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = req.headers.get("apikey");
  if (!key || !PUBLISHABLE_KEYS.includes(key)) return json({ error: "unauthorized" }, 401);

  try {
    // この関数 → データベースの接続が暗号化されているか（pg_stat_ssl は、自分の接続の状態を見られる）
    const [conn] = await sql`
      select ssl, version as tls_version, cipher, bits
      from pg_stat_ssl where pid = pg_backend_pid()`;

    // Postgresがいつ起動したか（=最後の再起動）
    const [db] = await sql`
      select pg_postmaster_start_time() as started_at, now() as now,
             current_setting('server_version') as server_version`;

    // 直近60分のcron実行を、1分ごとに数える（10秒ごとのジョブなら、1分に6回が目安）
    const perMinute = await sql`
      select date_trunc('minute', start_time) as minute, count(*)::int as runs
      from cron.job_run_details
      where start_time > now() - interval '60 minutes'
      group by 1 order by 1`;

    // 直近72時間で、実行の間隔が25秒を超えた所（空白）
    const gaps = await sql`
      with runs as (
        select start_time, lag(start_time) over (order by start_time) as prev
        from cron.job_run_details where start_time > now() - interval '72 hours')
      select prev as from_ts, start_time as to_ts, extract(epoch from (start_time - prev))::int as seconds
      from runs where start_time - prev > interval '25 seconds'
      order by start_time desc limit 20`;

    return json({ connection: conn ?? null, database: db, perMinute, gaps });
  } catch (e) {
    console.error(String(e));
    return json({ error: "server error" }, 500);
  }
});
