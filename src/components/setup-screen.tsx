import { Database, FileWarning, Terminal } from "lucide-react";

type SetupScreenProps = {
  message?: string;
};

const STEPS = [
  { command: "npm install", description: "依存パッケージをインストール" },
  {
    command: "npx prisma migrate dev --name init",
    description: "SQLite (prisma/dev.db) を作成",
  },
  { command: "npm run db:seed", description: "日本シーンの初期データを投入" },
  { command: "npm run dev", description: "http://localhost:3000 で起動" },
];

export function SetupScreen({ message }: SetupScreenProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-7 sm:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/25 bg-red-400/[0.07] text-red-300">
          <Database className="h-6 w-6" />
        </span>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300/80">
          Local Setup Required
        </p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-wide text-white sm:text-3xl">
          ローカル DB の準備が必要です
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          このアプリは SQLite をローカルファイルとして利用します。以下のコマンドを
          プロジェクト直下のターミナルで実行してください。外部クラウドには接続しません。
        </p>

        {message ? (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-[11px] leading-relaxed text-amber-200/80">
            <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all font-mono">{message}</span>
          </div>
        ) : null}

        <ol className="mt-7 space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.command}
              className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/25 p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-[10px] text-zinc-500">
                {index + 1}
              </span>
              <div className="min-w-0">
                <code className="flex items-center gap-1.5 font-mono text-xs text-emerald-300">
                  <Terminal className="h-3 w-3 text-zinc-600" />
                  {step.command}
                </code>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-zinc-600">
          データを初期状態に戻す場合: <code className="text-zinc-400">npm run db:reset</code>
          <br />
          ロスター情報の再取得: <code className="text-zinc-400">npm run update</code>
        </p>
      </div>
    </div>
  );
}
