# ssl-enforcement-check

[English](README.md) | 日本語

> コードのコメントを日本語にしたもの（画面も日本語）は [`ja/`](ja/) にあります。本体（`sql/` `scripts/` `supabase/` `app/`）は英語です。ファイルのパスは英語版のものを指しています。

Supabaseの「SSLを強制」スイッチを押す**前**と**後**で、接続の様子を確かめるための小さなスクリプトとSQLです。本物のDBパスワードは使いません。

> **個人の学習記録として作ったサンプルです。** 特定の会社の公式サンプルではありません。
> English summary: scripts to check a Postgres connection with `sslmode=disable` / `require` using a deliberately wrong password, before and after enabling "Enforce SSL" on a Supabase project, plus SQL to see how long the restart took (postmaster start time, cron run gap).

この記事のコードです:
- 手順編: Qiita「SupabaseでSSL接続を強制する手順と、設定変更時のデータベース再起動で起きること」
- アプリ編: Qiita「SSLとDB再起動を「見える化」するステータスページをつくってみた：暗号化されているかと、止まっていた時間を1画面で」（`app/` と `supabase/functions/security-status/`）

## 何をするものか

| ファイル | 役割 |
|---|---|
| `scripts/check-ssl.sh` | `sslmode=disable` と `sslmode=require` で、**わざと間違ったパスワード**で接続して、どの段階で断られるかを表示します |
| `sql/00_heartbeat_cron.sql` | （任意）再起動の空白を見るための、10秒ごとのcronジョブ |
| `sql/01_postgres_start_time.sql` | Postgresの起動時刻を聞いて、再起動したかを確かめます |
| `sql/02_cron_gap.sql` | cronの実行履歴の空白から、止まっていた時間の目安を見ます |

## ステータスページ（`app/`）

アプリ→データベースの接続の暗号化（`pg_stat_ssl`）、最後の再起動（`pg_postmaster_start_time()`）、cronの空白（`cron.job_run_details`）を1枚で見る、小さな画面です（HTML 1枚、ビルド不要）。

```bash
# supabase/functions/security-status/index.ts を、security-status という名前でデプロイ（Verify JWT はオフ。キーの確認は関数の中）
# 10秒ごとのcronジョブが必要です（sql/00_heartbeat_cron.sql）
cd app
cp config.example.js config.js     # URL と publishable キーを入れる（config.js は .gitignore 済み）
python3 -m http.server 8765 --bind 127.0.0.1   # → http://127.0.0.1:8765/index.html
```

- 画面が見ているのは「アプリ→DB」の接続だけです。外からの接続は `scripts/check-ssl.sh` で確かめます。
- **費用**: 30秒ごとに関数を呼びます。タブ1枚を開きっぱなしで、1日約2,880回・1か月約8万6千回（計算した目安）。Freeの月50万回（ドキュメントより）の約17%です。
- 私の環境では、接続はTLS 1.3（`TLS_AES_256_GCM_SHA384`）、再起動は2回とも空白1分17秒・1分29秒でした（2026年10月、小さな空のデモ）。
- 注意: ジョブが複数あると、空白の計算がずれます。起動時刻は最後の1回分しか分からないので、古い再起動は「不明」になります。公開するページには、本物のログインを付けてください。

## 必要なもの

- Supabaseのプロジェクト（私はFreeプランのデモで確認しました）
- ターミナルと `psql`（PostgreSQLのクライアント）
- 私が確認したのはMacだけです

## 費用

- 私のFreeプランでの実施では、このスイッチ自体に料金はかかりませんでした（料金の項目も見当たりませんでしたが、有料プランでの扱いは確認していません）。
- **ただし、スイッチを押すとデータベースが再起動します。** 私のデモ（空に近い一番小さいサイズ）では約20秒の空白でしたが、ダイアログには「数分のダウンタイム」とありました。本番では、お客さまが少ない時間に行ってください。

## 使い方

1. ダッシュボードの **Connect → Session pooler** で、接続先のホストとユーザー名を確認します。
2. **スイッチを押す前に**、テストを実行します。
   ```bash
   export PGHOST="aws-0-<リージョン>.pooler.supabase.com"
   export PGUSER="postgres.<PROJECT_REF>"
   ./scripts/check-ssl.sh
   ```
   押す前は、どちらも `password authentication failed` まで進みます（=暗号化なしでも、玄関までは入れる状態）。
3. **Project → Database → Settings** で **Enforce SSL on incoming connections** をオンにします（再起動が入ります）。
4. 同じテストを、もう一度実行します。`sslmode=disable` のほうが、パスワードの前に `(ESSLREQUIRED) SSL connection is required` と断られれば、強制が効いています。
   ```
   sslmode=disable  -> ... FATAL:  (ESSLREQUIRED) SSL connection is required for user: postgres
   sslmode=require  -> ... FATAL:  password authentication failed for user "postgres"
   ```
   （`psql` のバージョンで、メッセージの先頭が少し違うことがあります。）
5. 再起動を確かめるには、SQL Editorで `sql/01_postgres_start_time.sql` と `sql/02_cron_gap.sql` を実行します。10秒ごとのcronジョブがあれば、実行履歴の空白が「止まっていた時間」の目安になります（ジョブが無いなら `sql/00_heartbeat_cron.sql`）。

## 注意

- 接続テストのパスワードは、わざと間違った文字列です。**本物のパスワードを、このスクリプトや環境変数に入れないでください。**
- 私のDBの直接接続先（IPv6）には届かなかったので、IPv4で届く Session pooler を使いました。
- 測った数字は、**空に近い小さなデモでの1回の結果**です。本番のデータ量・接続数では変わります。
- `sslmode=require` は暗号化はしますが、接続先が本物かの確認まではしません。`verify-full` と証明書を使う方法は、私は試していません。

## 確かめられていないこと

- 大きなデータ・多くの接続がある本番での、再起動の時間
- `verify-full` と証明書を使う方法
- 他のリージョン・他の接続口（私は Session pooler だけで確認しました）
- Windows / Linux での手順

## 後片付け

`sql/00_heartbeat_cron.sql` を使った場合は、ファイルの末尾にある `cron.unschedule` を実行してジョブを消してください。

## ライセンス

MIT（`LICENSE` を参照）
