# AGENTS.md - プロジェクト開発・運用ルール

## 1. 開発環境・技術スタック
- **OS**: Windows (VS Code + OpenCode)
- **Framework**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Database**: SQLite + Prisma（ローカル完結・外部クラウド依存なし）
- **Data Source**: Liquipedia MediaWiki API (`[https://liquipedia.net/valorant/api.php](https://liquipedia.net/valorant/api.php)`)

## 2. サーバー起動・プロセス管理【厳守】
- **`npm run dev` や `npm start` などのローカル開発サーバーの自動起動・バックグラウンド常駐は禁止。**
- ポート占有やプロセス残存を防ぐため、サーバーの起動とブラウザでの動作確認はすべてユーザーが手動で行う。
- OpenCode側での動作確認は、型チェック（`npx tsc --noEmit`）やビルド確認（`npm run build`）のみで完結させること。

## 3. Git 操作の線引き【厳守】
- 機能実装・修正が完了し、`npm run build`（および型チェック）が正常に通過した区切りで、ローカルリポジトリへの `git add` および `git commit`（日本語で簡潔なコミットメッセージ）までを自動実行すること。
- **リモートへの `git push` やブランチの強制操作（`--force` 等）は禁止。** Pushはユーザーが手動で行う。

## 4. データ取得・API利用規約の遵守
- 外部有料APIやクラウド無料枠には依存しないこと。
- Liquipedia API (`api.php`) へリクエストを送る際は、必ずカスタム `User-Agent`（連絡先入り）および `Accept-Encoding: gzip` ヘッダーを付与し、連続リクエスト間には必ず3秒以上のウェイト（`sleep(3000)`）を設けること。

## 5. UI・デザイン統一ルール
- ベースカラー: ダークテーマ（Zinc / Slate 基調）
- ステータスバッジ配色:
  - `ACTIVE`: エメラルドグリーン系
  - `SUB` / `RESERVE`: スレートグレー系
  - `LFT`: アンバー / オレンジ系（視認性を高く強調）
  - `FA`: パープル系
  - `INACTIVE`: ダークグレー系

## 6. ロードマップ参照と進捗管理ルール
- 機能拡張の指示を受けた場合は、必ずプロジェクトルートの `ROADMAP.md` を参照し、指定された単一フェーズ（例: `Phase 2-1` のみ）の要件に従って実装すること。
- **トークン切れや中途半端な実装を防ぐため、一度に複数フェーズをまとめて実装しないこと。**
- 実装と `npm run build`（および型チェック）が正常に完了したら、`ROADMAP.md` 内の該当タスクのチェックボックスを `- [x]` に更新したうえで、ローカルリポジトリへ `git add` と `git commit` を実行すること。

## 7. 作業範囲の厳守ルール
- 作業対象は `Teamtrade/` ディレクトリ配下のみとする。
- 上記以外のディレクトリ・ファイルの検索（glob/grep）、一覧取得（list）、読み込み（read）は一切行わないこと。
