# 開発ロードマップ (ROADMAP.md)

このファイルは、eスポーツ プロチーム移籍・ロスター追跡ダッシュボードの全体仕様と段階的実装計画です。
各フェーズの実装時は、必ず `AGENTS.md` の運用ルール（サーバー自動起動禁止、ビルド通過後のローカル `git commit` まで・`git push` 禁止、Liquipedia API規約の遵守）に従ってください。

---

## 全体対象範囲（グランドデザイン）
1. **VALORANT**: 日本チームに限定（VCT Pacific 日本代表 / 日本 Tier2 VCJ 主要チーム）
2. **League of Legends**: 韓国地域（LCK 出場全チーム）
3. **第五人格 / Identity V**: 日本地域（IJL 出場全チーム）

---

## Phase 1: VALORANT JP 基盤・4チームMVP（完了）
- [x] Next.js + TypeScript + Tailwind CSS + SQLite (Prisma) の基盤構築
- [x] Liquipedia MediaWiki API (`api.php`) によるデータ取得スクリプト実装
- [x] 対象4チーム（ZETA, DFM, FENNEL, MURASH GAMING）のロスター・公式ロゴローカル保存
- [x] スタッフ職の除外と、選手（Active/Sub/LFT）優先・コーチ下部のソート表示
- [x] 移籍タイムラインのデータ整理

---

## Phase 2: UIデザインの洗練と基本操作の完成
- [x] **Phase 2-1: 2階層ナビゲーションとダークUI基盤の刷新**
  - トップヘッダー（ゲームタイトル切替: VALORANT / League of Legends / Identity V）とサブナビゲーション（ロスター / 順位表 / 移籍 / LFT市場）のUI枠組み作成。
  - 選択タイトルに応じたテーマアクセントカラー（VALO＝クリムゾンレッド系、LoL＝ゴールド＆シアン系、第五人格＝ゴシックパープル＆アンバー系）の適用。
  - 深いチャコールグレー（`zinc-950` / `zinc-900`）と極細ボーダーを用いた洗練されたチームカードレイアウトへの刷新。
- [x] **Phase 2-2: スタッフ表示トグル・国籍/インポート枠・お気に入り機能**
  - 「マネージャー・アナリストを表示する」トグルスイッチの追加（デフォルトOFF、ON時のみスタッフ行を表示）。
  - 選手の国籍フラグ表示と、チームごとの外国人助っ人枠（`Import` 数）バッジの表示。
  - `localStorage` を利用したチームのお気に入り登録（★ピン留め）と最上部固定表示。
- [x] **Phase 2-3: 選手詳細モーダル＆チーム詳細モーダル（UI枠組み）の実装**
  - 選手クリック時：過去所属チーム・在籍期間タイムライン・公式発表元URL表示。
  - チーム名/ロゴクリック時：チーム詳細モーダル（過去大会実績・直近試合結果・次戦予定の表示枠）の実装。

---

## Phase 3: マルチタイトル＆全機能対応のDBスキーマ拡張
- [x] **Phase 3-1: Prismaスキーマの拡張とマイグレーション**
  - `Game`（VALORANT / LoL / IdentityV）、`Region`、`Player.role`（タイトル別ロール）、`Player.staffCategory`（PLAYER / COACH / STAFF）、`Player.nationality` をスキーマに追加。
  - 新規モデル追加：`Standing`（公式リーグ順位・勝敗・ポイント）、`TeamAchievement`（過去大会実績）、`TeamMatch`（直近結果・次戦予定・`streamUrl`）。

---

## Phase 4: VALORANT 日本チームの詳細データ取得
- [x] **Phase 4-1: VCT Pacific 日本代表 & JP Tier2（VCJ）のロスター・ロール・国籍取得**
  - VCT Pacific 日本代表チームおよび日本Tier2主要チームのLiquipedia取得。
  - ロール（Duelist / Initiator / Controller / Sentinel / Flex / IGL）バッジ・アイコンおよび国籍コードの自動抽出。
  - VALORANT 日本チーム一括更新コマンド（`npm run update:valo`）の整備。
- [x] **Phase 4-2: LFT / FA 市場専用ビューの UI 実装**
  - LFT / FA / Inactive / Sub などの移籍市場選手を横断表示する専用ビュー。
  - ステータス別・ロール別フィルター、テキスト検索、選手お気に入り登録、選手詳細モーダル連携。
  - ストリーマー / クリエイター系スタッフはデフォルトで除外し、スタッフ表示トグル ON 時のみ対象に含める。
- [x] **Phase 4-3: チームの「過去大会実績」＆「直近・次戦マッチ＋YouTubeリンク」取得実装**
  - チーム個別ページから `Results`（大会実績）と `Matches`（直近結果・次戦予定）を抽出・保存。
  - 試合情報にLiquipediaから抽出した配信・VOD URLを紐付け、未登録の場合は公式YouTubeチャンネルまたは試合検索URLへフォールバックする `[ Watch / VOD ]` リンクを生成。
  - トップ画面上部の横スクロール「マッチティッカー」およびチーム詳細モーダルへ反映。

---

## Phase 5: 他タイトルの追加（LoL LCK ＋ 第五人格 IJL）
- [x] **Phase 5-1: League of Legends（韓国 LCK）の実装**
  - `[https://liquipedia.net/leagueoflegends/api.php](https://liquipedia.net/leagueoflegends/api.php)` からのLCK全10チーム取得スクリプト（`npm run update:lol`）。
  - LoL専用ロール（`Top`, `Jungle`, `Mid`, `Bot`, `Support`）のバッジ・アイコン表示。
- [x] **Phase 5-2: 第五人格 / Identity V（日本 IJL）の実装**
  - `[https://liquipedia.net/identityv/api.php](https://liquipedia.net/identityv/api.php)` からのIJL出場チーム取得スクリプト（`npm run update:idv`）。
  - 第五人格専用ロール（`Survivor`, `Hunter`）のバッジ・アイコン表示。

---

## Phase 6: 公式順位表（ハイブリッド強さランキング）の実装
- [x] **Phase 6-1: リーグ公式順位表データの自動取得処理**
  - VCTサーキットポイント、LCKレギュラーシーズン順位、IJL順位のLiquipedia大会ページからの取得・DB保存処理の実装。
- [x] **Phase 6-2: ハイブリッド順位表示UIの実装**
  - チームカード右上の `#1` ランクバッジ表示および「順位順ソート」機能の追加。
  - サブタブ `[ 順位表 (Standings) ]` での詳細リーグテーブル（順位・勝敗・ポイント）表示、およびカード上の `#1` クリック時の順位表連携。

---

## Phase 7: 最終仕上げ・ドキュメント整備
- [x] **Phase 7-1: 全体動作調整と人間向け `README.md` の整備**
  - ローカルセットアップ手順および各タイトル・地域別の `npm run update:*` コマンド一覧をまとめた `README.md` の作成。
