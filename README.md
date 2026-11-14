# VALO-ROSTER JP

日本の **VALORANT** プロシーンを対象にした、**完全ローカル完結型**のプロチーム移籍・ロスター追跡ダッシュボードです。

- 外部クラウド（Vercel / Supabase / GitHub Actions など）、DB の無料枠、有料 API は一切使用しません。
- データはローカルの **SQLite**（`prisma/dev.db`）に保存します。
- `http://localhost:3000` で動作するスタンドアロン型 Web アプリです。
- データ収集は **Liquipedia（VALORANT）** をローカル CLI（`npm run update`）から取得し、SQLite に Upsert します。
- 対象チームは **ZETA DIVISION / DetonatioN FocusMe / FENNEL / QTnet DISCONNECT** の 4 チームのみです。旧チーム・新チームのいずれかがこの 4 チームに一致する移籍だけを保存します。

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS 3.4 |
| UI | shadcn/ui スタイルのローカルコンポーネント（Radix UI / CVA） |
| アイコン | Lucide Icons |
| DB | SQLite + Prisma 6 |
| スクレイピング | Cheerio + Node.js `fetch` |
| ローカル CLI | tsx |

## セットアップ

前提: Node.js 20.9 以上 / npm 10 以上。

```bash
cd "C:\Users\masaki koudai\Solo.dev\TeamTrade"

# 1. 依存パッケージ
npm install

# 2. SQLite DB とテーブルを作成（prisma/dev.db）
npx prisma migrate dev

# 3. 日本の VALORANT シーンを模した初期データを投入
npm run db:seed

# 4. 開発サーバー起動
npm run dev
```

ブラウザで <http://localhost:3000> を開いてください。

> `.env` が無い場合は作成してください。
>
> ```env
> DATABASE_URL="file:./dev.db"
> ```
>
> `file:./dev.db` は `prisma/schema.prisma` からの相対パスです。実体は `prisma/dev.db` に生成されます。

### 本番相当のローカル起動

```bash
npm run build
npm run start
```

`http://localhost:3000` で起動します。外部サーバーへのデプロイは想定していません。

## 画面の機能

- **固定ヘッダー**: アプリロゴ（`VALO-ROSTER JP`）、タイトル切替タブ（VALORANT 固定）、最終データ同期日時（`Last synced`）、`npm run update` の案内。
- **コントロールバー**:
  - 選手名・チーム名・ロールのリアルタイムインクリメンタル検索。
  - ステータスフィルター（すべて / LFT・FAのみ / Activeのみ）。
  - 表示切替（チーム別ロスター表示 / 直近の移籍タイムライン表示）。
- **チーム別グリッド**: 最大 4 カラムのレスポンシブカード。チーム名、略称、リージョン（JP）、ロスター、ロール、ステータスバッジを表示。
- **ステータスバッジ**:
  - `Active`（エメラルド）
  - `Sub / Reserve`（スレート）
  - `LFT`（アンバー）
  - `FA`（パープル）
  - `Inactive`（ダークグレー）
- **選手詳細モーダル**: 選手名クリックで表示。現在のステータス・所属チーム、公式発表元リンク（Liquipedia 記載の X / チーム公式 URL）、移籍・所属の垂直ステップタイムライン（最新順）を表示。
- **LFT / FA 選手一覧**: LFT / FA 選手をカード形式で一覧表示。前所属と期間、経歴モーダルを確認できます。
- **移籍タイムライン**: 加入・移籍・退団・LFT・FA・休止 / 引退を新しい順に表示。出典リンクから公式発表を開けます。

## プロジェクト構成

```text
prisma/
  schema.prisma          # Game / Region / Team / Player / MembershipHistory / TransferEvent / UpdateLog
  seed.ts                # 日本シーンの初期データ
  migrations/            # SQLite マイグレーション
  dev.db                 # ローカル SQLite（生成物・Git 管理外）
scripts/
  fetch-liquipedia.ts    # npm run update の本体（Liquipedia 取得 → SQLite Upsert）
  update-roster.ts       # 旧・チーム公式サイト取得の実験用スクリプト（任意）
  sources.ts             # 上記スクリプトの取得対象定義
  lib/roster-parser.ts   # 上記スクリプトの HTML パーサー
  fixtures/
    liquipedia-transfers.html  # Liquipedia 移籍表のオフライン確認用フィクスチャ
    roster-sample.html         # 旧パーサー確認用フィクスチャ
src/
  app/
    layout.tsx
    page.tsx             # サーバーコンポーネント（DB 読み込み）
    globals.css          # ダークテーマ / 背景グリッド
  components/
    dashboard.tsx        # 検索・フィルター・表示モードの状態管理
    app-header.tsx
    control-bar.tsx
    team-card.tsx
    free-agent-card.tsx
    player-modal.tsx     # 移籍・所属タイムライン
    transfer-timeline.tsx
    status-badge.tsx
    team-logo.tsx
    player-avatar.tsx
    setup-screen.tsx     # DB 未作成時のガイド
    ui/                  # shadcn/ui スタイルのプリミティブ
  lib/
    prisma.ts
    roster.ts            # DB → 画面用 DTO 変換（対象4チームに限定）
    status.ts            # ステータス・ロール・チームアクセント定義
    target-teams.ts      # 対象4チーム・表記揺れ・正規化ルール
    types.ts
    utils.ts
```

## Liquipedia 更新 CLI

`npm run update` は `scripts/fetch-liquipedia.ts` を実行し、Liquipedia の
[Portal:Transfers](https://liquipedia.net/valorant/Portal:Transfers) から直近の移籍・退団・LFT / FA を取得して SQLite に反映します。

```bash
# 最新の移籍情報を取得して DB を更新
npm run update

# DB を変更せず、解析結果だけ確認
npm run update -- --dry-run --verbose

# ローカル HTML フィクスチャでパーサーを確認（ネットワーク不要）
npm run update:fixture

# 対象4チームのロスターも取得（チームページを追加取得）
npm run update -- --teams
```

> 取得対象は **ZETA DIVISION / DetonatioN FocusMe / FENNEL / QTnet DISCONNECT** の 4 チームのみです。
> 旧チームまたは新チームがこの 4 チームに一致する移籍・LFT / FA 行だけを保存し、
> それ以外のチーム・地域のイベントはすべてスキップします。

### Liquipedia 規約遵守

スクレイピング処理には以下を必ず実装しています。

1. **カスタム User-Agent**: 既定値は
   `ValorantRosterTracker/1.0 (local-personal-tool; contact@example.com)`。
   `LIQUIPEDIA_USER_AGENT` 環境変数で上書きできます。連絡先を括弧内に含めない場合は実行を中止します。
2. **Rate Limit**: すべてのリクエスト間に最低 **2,500ms** の待機を挟みます（`await sleep(2500)`）。
   `LIQUIPEDIA_DELAY_MS` で延長できますが、2,500ms 未満にはできません。
3. **Cloudflare Turnstile は自動回避しません**。403 / captcha を検出した場合は処理を中止し、
   ブラウザでページを開いてから再実行するよう案内します。
4. 取得結果は `TransferEvent.dedupeKey` で重複排除し、`upsert` で更新します。

### オプション

| オプション | 説明 |
| --- | --- |
| `--dry-run` | DB へ書き込まず、解析結果だけ表示 |
| `--verbose` | 取り込むイベントを 1 件ずつ表示 |
| `--debug` | 取得した HTML を `scripts/.cache/` に保存 |
| `--fixture=<path>` | ネットワーク取得の代わりにローカル HTML を解析 |
| `--url=<url>` | 取得先 URL を変更（既定: Portal:Transfers） |
| `--limit=<n>` | 取り込むイベント数の上限（既定: 150） |
| `--timeout=<ms>` | 1 リクエストのタイムアウト（既定: 20000ms） |
| `--delay=<ms>` | リクエスト間隔（2,500ms 未満は無視） |
| `--teams` | 対象4チーム（ZETA / DFM / FENNEL / QTD）のロスターも取得 |

### 更新結果

- 移籍イベントは `TransferEvent` に保存され、「直近の移籍タイムライン」に表示されます。
- 加入・移籍は `MembershipHistory` の現所属を更新し、退団・LFT / FA・休止は現所属を終了します。
- 実行結果は `UpdateLog` に保存され、ヘッダーの `Last synced` に反映されます。
- 取得に失敗した場合も `UpdateLog` に `FAILED` として記録されます。

## データモデル

```text
Game 1 ── * Team * ── 1 Region
  │           │
  │           └── * MembershipHistory * ── 1 Player
  ├── * Player
  └── * TransferEvent
```

- `Game`: VALORANT / LoL / CS2 など。`slug` で切替。
- `Region`: JP / KR など。Team と Player の両方に紐づけ可能。
- `Team`: チーム名、略称、ロゴ URL、公式 URL、地域、表示順。
- `Player`: ハンドル、本名（任意）、現在ステータス（`ACTIVE` / `SUB` / `LFT` / `FA` / `INACTIVE`）、X / 公式 URL、メモ。
- `MembershipHistory`: 所属チーム、ロール、開始年月・終了年月、現所属フラグ、公式発表 URL。
- `TransferEvent`: Liquipedia から取得した移籍イベント（加入 / 移籍 / 退団 / LFT / FA / 休止 / 引退）、出典 URL、重複排除キー。
- `UpdateLog`: ローカル更新 CLI の実行履歴（ヘッダー表示用）。

日付は画面表示と SQLite での比較を単純化するため `YYYY-MM`（移籍イベントは `YYYY-MM-DD`）の文字列で保持しています。
現在所属は `MembershipHistory.isCurrent = true` で表現します。

## 初期データ

`npm run db:seed` で以下を投入します（すべてデモ用のフィクションデータです）。

- 4 チーム: ZETA DIVISION / DetonatioN FocusMe / FENNEL / QTnet DISCONNECT
- 各チーム 6 名（選手 + コーチ、一部 Sub）: 合計 24 名
- 上記4チームの元所属である LFT 3 名 / FA 2 名 / 休止（Inactive）1 名
- 対象4チーム内の過去所属・移籍履歴と公式発表 URL
- 移籍タイムライン用のイベントと初期 `UpdateLog`

> 実在チーム名をモックとして使用していますが、選手名・履歴・発表 URL はデモ用です。実データではありません。

## よく使うコマンド

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run start        # 本番起動
npm run db:generate  # Prisma Client 生成
npm run db:migrate   # マイグレーション作成・適用
npm run db:seed      # 初期データ投入
npm run db:reset     # DB を初期化して再シード
npm run update       # Liquipedia からローカル更新
npm run update:teams # Liquipedia の移籍 + 対象4チームのロスターを更新
npm run update:dry   # Liquipedia 更新の dry-run
npm run update:fixture # 同梱フィクスチャでパーサー確認
```

## トラブルシューティング

- **「ローカル DB の準備が必要です」と表示される**
  - `npx prisma migrate dev` → `npm run db:seed` の順に実行してください。
- **`npm run update` が 403 / captcha で失敗する**
  - Liquipedia は自動アクセスに Cloudflare Turnstile を出すことがあります。規約に従い自動回避は行いません。
    ブラウザで <https://liquipedia.net/valorant/Portal:Transfers> を開ける状態にしてから、時間を置いて再実行してください。
  - ネットワークに接続できない場合は `npm run update:fixture` でパーサーと DB 反映を確認できます。
- **ポート 3000 が使用中**
  - `npm run dev -- -p 3001` で別ポートを使用できます。
- **データを初期状態に戻したい**
  - `npm run db:reset`（確認後、初期データを再投入）。
- **Prisma のエンジンエラー**
  - `npm install` 後に `npm run db:generate` を実行してください。
- **esbuild のプラットフォーム不一致エラー（`@esbuild/linux-x64` / `@esbuild/win32-x64`）**
  - WSL と Windows で `node_modules` を共有すると発生します。実行する環境で `node_modules` を削除し、`npm install` をやり直してください。

## 設計上の保証

- 外部クラウド DB / ホスティング / 有料 API / 従量課金サービスへの依存はありません。
- Web アプリの起動時に外部通信は行いません（SQLite の読み込みのみ）。
- 外部通信は明示的に実行した `npm run update` の CLI のみです。
- データは PC 内の `prisma/dev.db` に閉じます。バックアップはこのファイルをコピーしてください。
