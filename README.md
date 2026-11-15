# TEAMTRADE

**TEAMTRADE** は、eスポーツ プロチームのロスター・移籍・公式順位をひとつのダッシュボードで追跡する、**完全ローカル完結型** Web アプリケーションです。

対応タイトル:

- **VALORANT**（日本: VCT Pacific 日本代表 / VCJ Tier2）
- **League of Legends**（韓国: LCK 全10チーム）
- **Identity V / 第五人格**（日本: IJL 出場全チーム）

外部クラウド DB（Vercel / Supabase など）、有料 API、従量課金サービスには一切依存しません。データはローカルの **SQLite**（`prisma/dev.db`）に保存され、取得元は **Liquipedia MediaWiki API** です。

## 主な機能

- **マルチタイトル 2 階層ナビゲーション**
  - トップヘッダーで **VALORANT / League of Legends / Identity V** を切り替え。
  - サブナビゲーションで **ロスター / 順位表 / 移籍 / LFT市場** を切り替え。
  - タイトルごとにテーマアクセントカラーを自動適用（VALORANT = クリムゾンレッド / LoL = ゴールド＆シアン / Identity V = ゴシックパープル＆アンバー）。
- **チーム別ロスター表示**
  - 選手の役割（VALORANT ロール / LoL レーン / Identity V サバイバー・ハンター）をバッジ表示。
  - ステータス別バッジ: `Active` / `Sub / Reserve` / `LFT` / `FA` / `Inactive`。
  - 国籍フラグ（絵文字）と、チームごとの外国人助っ人枠 `Import` バッジ。
  - マネージャー・アナリスト・ストリーマー等のスタッフはトグルで表示 / 非表示。
- **LFT / FA 市場ビュー**
  - 移籍市場に含まれる選手を横断表示。
  - ステータス・ロール・テキスト検索、選手お気に入り機能。
- **移籍タイムライン**
  - 加入・移籍・退団・LFT・FA・休止 / 引退を新しい順に表示。
  - 選手名クリックで経歴モーダル、出典リンクで公式発表を開けます。
- **マッチティッカー & 試合リンク**
  - チーム詳細モーダルに直近試合結果・次戦予定を表示。
  - Liquipedia から抽出した配信 / VOD URL、または公式 YouTube へのフォールバックリンクを生成。
- **公式順位表ハイブリッド表示**
  - リーグ公式順位（勝敗・ポイント・差分）を取得・表示。
  - チームカード右上の `#1` ランクバッジ、または「順位表」タブで詳細テーブルを確認。
  - 順位順ソート機能。
- **チーム / 選手のお気に入り**
  - `localStorage` に保存するチームのピン留めと選手のお気に入り。お気に入りチームは最上部に固定表示。

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS 3.4 |
| UI コンポーネント | shadcn/ui スタイルのローカルコンポーネント（Radix UI / CVA） |
| アイコン | Lucide Icons |
| DB / ORM | SQLite + Prisma 6 |
| スクレイピング | Cheerio + Node.js `fetch` |
| ローカル CLI | tsx |

## 初回セットアップ

前提: Node.js 20.9 以上 / npm 10 以上。

```bash
cd "C:\Users\masaki koudai\Solo.dev\TeamTrade"

# 1. 依存パッケージをインストール
npm install

# 2. SQLite DB とテーブルを作成（prisma/dev.db）
npx prisma migrate dev

# 3. 日本 VALORANT シーンを模した初期データを投入（任意）
npm run db:seed

# 4. 開発サーバーを起動
npm run dev
```

ブラウザで <http://localhost:3000> を開いてください。

> `.env` が無い場合は、プロジェクトルートに以下を作成してください。
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

## データ更新コマンド一覧

ローカル SQLite のデータを Liquipedia MediaWiki API から更新するコマンドです。`package.json` の `scripts` と一致しています。

| コマンド | 用途 |
| --- | --- |
| `npm run update:valo` | VALORANT 日本チーム（VCT Pacific / VCJ）のロスター・試合・順位を更新 |
| `npm run update:lol` | League of Legends LCK 全10チームのロスター・試合・順位を更新 |
| `npm run update:idv` | Identity V IJL 出場チームのロスター・試合・順位を更新 |
| `npm run update:standings` | 3 タイトルの公式順位表を一括更新 |
| `npm run update:standings:dry` | 順位表の一括更新を dry-run モードで実行 |
| `npm run update:dry` | VALORANT 更新の dry-run / verbose 版（DB 変更なし） |
| `npm run update:fixture` | 同梱のローカル HTML フィクスチャでパーサー確認（ネットワーク不要） |

### オプション

各 `npm run update:*` コマンドに `--` を挟んで以下のオプションを渡せます。

```bash
# DB を変更せず、取得・解析結果だけ確認
npm run update:valo -- --dry-run --verbose

# 24 時間キャッシュを無視して強制更新
npm run update:valo -- --force

# 特定チームだけ更新（対象スクリプトによって利用可能）
npm run update:valo -- --team=ZETA_DIVISION
```

| オプション | 説明 |
| --- | --- |
| `--dry-run` | DB へ書き込まず、取得・解析結果だけ表示 |
| `--verbose` | 取得した全選手・警告を表示 |
| `--force` | 24 時間キャッシュを無視して強制更新 |
| `--debug` | API レスポンスを `scripts/.cache/` に保存 |
| `--fixture=<path>` | ネットワーク取得の代わりにローカル HTML / JSON を解析 |
| `--team=<name>` | 取得対象を 1 チームに絞る |
| `--timeout=<ms>` | 1 リクエストのタイムアウト（既定: 30000ms） |
| `--delay=<ms>` | リクエスト間隔（Liquipedia 規約により 30000ms 未満は無視） |

### Liquipedia API 運用上の注意事項

TEAMTRADE は Liquipedia MediaWiki API を利用しています。以下の運用ルールを守ってください。

1. **リクエスト間の 30 秒ウェイト**
   - 各スクリプトは連続リクエスト間に **最低 30 秒** の待機を入れています（`LIQUIPEDIA_DELAY_MS` 環境変数で変更可能ですが、30 秒未満にはできません）。
2. **24 時間キャッシュ**
   - 同じチーム・同じ種別のページは 24 時間キャッシュします。短時間に同じデータを取り直したい場合は `--force` を付けてください。
3. **429 Too Many Requests 発生時**
   - Liquipedia 側のレート制限に引っかかった場合、処理を停止します。**しばらく時間を置いてから再実行してください**。
4. **カスタム User-Agent**
   - リクエストには `User-Agent` ヘッダー（連絡先先入り）と `Accept-Encoding: gzip` を付与しています。既定値は各タイトル用スクリプト内に定義されており、`LIQUIPEDIA_USER_AGENT` 環境変数で上書きできます。連絡先を含まない場合は実行を停止します。
5. **Cloudflare Turnstile / captcha**
   - 自動回避は行いません。403 / captcha を検出した場合はブラウザで Liquipedia ページを開いてから、時間を置いて再実行してください。

## よく使うコマンド

```bash
npm run dev                 # 開発サーバー起動
npm run build               # 本番ビルド
npm run start               # 本番起動
npm run db:generate         # Prisma Client 生成
npm run db:migrate          # マイグレーション作成・適用
npm run db:seed             # 初期データ投入
npm run db:reset            # DB を初期化して再シード
npm run update:valo         # VALORANT ロスター更新
npm run update:lol          # LoL LCK ロスター更新
npm run update:idv          # Identity V IJL ロスター更新
npm run update:standings    # 公式順位表一括更新
```

## プロジェクト構成

```text
prisma/
  schema.prisma          # Game / Region / Team / Player / MembershipHistory / TransferEvent / Standing / TeamAchievement / TeamMatch / UpdateLog
  seed.ts                # 日本シーンの初期デモデータ
  migrations/            # SQLite マイグレーション
  dev.db                 # ローカル SQLite（生成物・Git 管理外）
scripts/
  fetch-liquipedia.ts    # VALORANT 取得（npm run update:valo）
  fetch-lol.ts           # LoL LCK 取得（npm run update:lol）
  fetch-idv.ts           # Identity V IJL 取得（npm run update:idv）
  update-standings.ts    # 公式順位表一括更新（npm run update:standings）
  lib/
    roster-parser.ts     # ロスター HTML パーサー（共通）
    standings-fetcher.ts # 順位表取得ロジック（共通）
src/
  app/
    layout.tsx
    page.tsx             # サーバーコンポーネント（DB 読み込み）
    globals.css          # ダークテーマ / タイトル別テーマ変数
  components/
    dashboard.tsx        # 検索・フィルター・タイトル/サブセクションの状態管理
    app-header.tsx       # タイトル切替ヘッダー
    section-nav.tsx      # ロスター / 順位表 / 移籍 / LFT市場 のサブナビ
    region-tabs.tsx      # 地域タブ
    control-bar.tsx      # 検索・ステータスフィルター・ソート・スタッフトグル
    market-filter-bar.tsx
    market-player-card.tsx
    team-card.tsx
    team-logo.tsx
    team-modal.tsx
    player-avatar.tsx
    player-modal.tsx
    nationality-flag.tsx
    status-badge.tsx
    transfer-timeline.tsx
    standings-table.tsx
    section-placeholder.tsx
    setup-screen.tsx
    ui/                  # shadcn/ui スタイルのプリミティブ
  lib/
    prisma.ts
    games.ts             # タイトル別テーマ・サブナビゲーション定義
    roles.ts             # 選手 / コーチ / スタッフの役職判定
    status.ts            # ステータス・ロール・チームアクセント定義
    nationality.ts       # 国名 → ISO コード / 国旗 / Import 判定
    target-teams.ts      # VALORANT 日本対象チーム定義
    lol-teams.ts         # LCK 対象チーム定義
    idv-teams.ts         # IJL 対象チーム定義
    roster.ts            # DB → 画面用 DTO 変換
    types.ts             # DTO 型定義
    use-favorites.ts     # localStorage なチームお気に入りフック
    use-player-favorites.ts
    utils.ts
public/
  logos/                 # 自動保存されるチームロゴ（Git 管理外）
  players/               # 自動保存される選手アバター（Git 管理外）
```

## トラブルシューティング

- **「ローカル DB の準備が必要です」と表示される**
  - `npx prisma migrate dev` → `npm run db:seed` の順に実行してください。
- **`npx tsc --noEmit` が `.next/types/**/*.ts` で失敗する**
  - `npm run build` を一度実行して `.next/types` を生成するか、`.next` ディレクトリを削除後に `npm run build` を実行してください。
- **`npm run update:*` が 403 / captcha / 429 で失敗する**
  - Liquipedia は自動アクセスに制限を出すことがあります。規約に従い自動回避は行いません。ブラウザで対象ページを開ける状態にしてから、**数十分以上時間を置いて**再実行してください。
  - ネットワークに接続できない場合は `npm run update:fixture` でパーサーを確認できます（dry-run のため DB は変更しません）。
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
- 外部通信は明示的に実行した `npm run update:*` 系 CLI のみです。
- データは PC 内の `prisma/dev.db` と `public/logos/` / `public/players/` に閉じます。バックアップはこれらのファイルをコピーしてください。

## ライセンス

個人・ローカル利用を前提としています。Liquipedia のデータを利用する際は、各ページのライセンス（CC BY-SA 3.0）および利用規約を遵守してください。
