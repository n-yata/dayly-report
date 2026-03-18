# 営業日報システム

営業担当者の日次活動（顧客訪問・課題・翌日計画）を記録し、上長が承認するシステム。

## 技術スタック

- **フレームワーク**: Next.js (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **DB ORM**: Prisma
- **DB**: PostgreSQL (開発: Docker / 本番: Cloud SQL)
- **テスト**: Vitest
- **デプロイ**: Google Cloud Run

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集し、`DATABASE_URL` を設定します。

| 変数名         | 説明                                              |
| -------------- | ------------------------------------------------- |
| `PROJECT_ID`   | GCP プロジェクト ID（Cloud Run デプロイ時に使用） |
| `DATABASE_URL` | PostgreSQL 接続 URL                               |

### 3. ローカル DB の起動

Docker が必要です。

```bash
docker compose up -d db
```

これにより `localhost:5433` で PostgreSQL が起動します。

接続情報:

- Host: `localhost`
- Port: `5433`（ホスト側。コンテナ内は5432）
- User: `dayly_report`
- Password: `dayly_report`
- Database: `dayly_report`

### 4. DB マイグレーションの実行

```bash
npx prisma migrate dev
```

### 5. シードデータの投入

```bash
npx prisma db seed
```

投入されるアカウント（パスワード共通: `password123`）:

| メールアドレス     | 氏名      | ロール  |
| ------------------ | --------- | ------- |
| tanaka@example.com | 田中 太郎 | sales   |
| sato@example.com   | 佐藤 花子 | sales   |
| yamada@example.com | 山田 部長 | manager |

### 6. Prisma Studio（DB ブラウザ）

```bash
npx prisma studio
```

ブラウザで `http://localhost:5555` が開き、データを確認できます。

---

## 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます（`/daily-reports` にリダイレクトされます）。

---

## テスト

```bash
npm test
```

---

## デプロイ

Cloud Run へのデプロイには `.env.local` に `PROJECT_ID` の設定が必要です。

```bash
make deploy
```

---

## DB スキーマの変更手順

1. `prisma/schema.prisma` を編集
2. `npx prisma migrate dev --name <変更内容の説明>` でマイグレーションファイルを生成・適用
3. `npx prisma generate` で Prisma Client を再生成（通常は migrate dev が自動実行）
