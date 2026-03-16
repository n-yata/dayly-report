# 営業日報システム API仕様書

## 共通仕様

### ベースURL

```
/api/v1
```

### 認証

全エンドポイント（ログインを除く）はリクエストヘッダーに Bearer トークンが必要。

```
Authorization: Bearer {token}
```

### レスポンス形式

Content-Type: `application/json`

**成功時**

```json
{
  "data": { ... }
}
```

**エラー時**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "エラーメッセージ"
  }
}
```

### 共通エラーコード

| HTTPステータス | コード             | 説明                               |
| -------------- | ------------------ | ---------------------------------- |
| 400            | `VALIDATION_ERROR` | バリデーションエラー               |
| 401            | `UNAUTHORIZED`     | 未認証                             |
| 403            | `FORBIDDEN`        | 権限不足                           |
| 404            | `NOT_FOUND`        | リソースが存在しない               |
| 409            | `CONFLICT`         | 重複エラー（同日の日報が既存など） |

---

## API一覧

| メソッド | パス                             | 説明             | 権限          |
| -------- | -------------------------------- | ---------------- | ------------- |
| POST     | /auth/login                      | ログイン         | 全員          |
| POST     | /auth/logout                     | ログアウト       | 全員          |
| GET      | /daily-reports                   | 日報一覧取得     | 全員          |
| POST     | /daily-reports                   | 日報作成         | sales         |
| GET      | /daily-reports/:id               | 日報詳細取得     | 全員          |
| PUT      | /daily-reports/:id               | 日報更新         | sales（本人） |
| POST     | /daily-reports/:id/submit        | 日報提出         | sales（本人） |
| POST     | /daily-reports/:id/approve       | 日報承認         | manager       |
| POST     | /daily-reports/:id/reject        | 日報差し戻し     | manager       |
| POST     | /daily-reports/:id/visit-records | 訪問記録追加     | sales（本人） |
| PUT      | /visit-records/:id               | 訪問記録更新     | sales（本人） |
| DELETE   | /visit-records/:id               | 訪問記録削除     | sales（本人） |
| GET      | /daily-reports/:id/comments      | コメント一覧取得 | 全員          |
| POST     | /daily-reports/:id/comments      | コメント投稿     | 全員          |
| GET      | /customers                       | 顧客一覧取得     | 全員          |
| POST     | /customers                       | 顧客登録         | manager       |
| PUT      | /customers/:id                   | 顧客更新         | manager       |
| DELETE   | /customers/:id                   | 顧客削除         | manager       |
| GET      | /users                           | ユーザー一覧取得 | manager       |
| POST     | /users                           | ユーザー登録     | manager       |
| PUT      | /users/:id                       | ユーザー更新     | manager       |

---

## 認証

### POST /auth/login

**リクエスト**

```json
{
  "email": "tanaka@example.com",
  "password": "password123"
}
```

**レスポンス** `200 OK`

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "田中 太郎",
      "email": "tanaka@example.com",
      "role": "sales"
    }
  }
}
```

### POST /auth/logout

**レスポンス** `200 OK`

```json
{
  "data": null
}
```

---

## 日報

### GET /daily-reports

日報一覧を取得する。salesは自分の日報のみ、managerは全件取得できる。

**クエリパラメータ**

| パラメータ | 型                | 必須 | 説明                                            |
| ---------- | ----------------- | ---- | ----------------------------------------------- |
| from       | date (YYYY-MM-DD) | -    | 期間開始日（デフォルト: 当月1日）               |
| to         | date (YYYY-MM-DD) | -    | 期間終了日（デフォルト: 当月末日）              |
| user_id    | int               | -    | 担当者フィルター（managerのみ使用可）           |
| status     | string            | -    | `draft` / `submitted` / `approved` / `rejected` |

**レスポンス** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "report_date": "2026-03-16",
      "status": "submitted",
      "visit_count": 3,
      "user": {
        "id": 1,
        "name": "田中 太郎"
      },
      "created_at": "2026-03-16T18:00:00Z",
      "updated_at": "2026-03-16T18:30:00Z"
    }
  ]
}
```

---

### POST /daily-reports

日報を新規作成する。同日の日報が既に存在する場合は 409 を返す。

**リクエスト**

```json
{
  "report_date": "2026-03-16",
  "problem": "予算承認が通らず商談が止まっている。",
  "plan": "株式会社Aへ見積書を送付する。",
  "visit_records": [
    {
      "customer_id": 10,
      "visit_time": "10:00",
      "purpose": "新製品の提案",
      "case_product": "商品X",
      "next_action": "来週までに見積送付"
    },
    {
      "customer_id": 20,
      "visit_time": "14:00",
      "purpose": "定例MTG",
      "case_product": "商品Y",
      "next_action": null
    }
  ]
}
```

**レスポンス** `201 Created`

```json
{
  "data": {
    "id": 1,
    "report_date": "2026-03-16",
    "problem": "予算承認が通らず商談が止まっている。",
    "plan": "株式会社Aへ見積書を送付する。",
    "status": "draft",
    "approved_by": null,
    "approved_at": null,
    "user": {
      "id": 1,
      "name": "田中 太郎"
    },
    "visit_records": [
      {
        "id": 1,
        "customer_id": 10,
        "customer_name": "株式会社A",
        "visit_time": "10:00",
        "purpose": "新製品の提案",
        "case_product": "商品X",
        "next_action": "来週までに見積送付"
      }
    ],
    "created_at": "2026-03-16T18:00:00Z",
    "updated_at": "2026-03-16T18:00:00Z"
  }
}
```

---

### GET /daily-reports/:id

**レスポンス** `200 OK`

```json
{
  "data": {
    "id": 1,
    "report_date": "2026-03-16",
    "problem": "予算承認が通らず商談が止まっている。",
    "plan": "株式会社Aへ見積書を送付する。",
    "status": "submitted",
    "approved_by": null,
    "approved_at": null,
    "user": {
      "id": 1,
      "name": "田中 太郎"
    },
    "visit_records": [
      {
        "id": 1,
        "customer_id": 10,
        "customer_name": "株式会社A",
        "visit_time": "10:00",
        "purpose": "新製品の提案",
        "case_product": "商品X",
        "next_action": "来週までに見積送付"
      }
    ],
    "created_at": "2026-03-16T18:00:00Z",
    "updated_at": "2026-03-16T18:30:00Z"
  }
}
```

---

### PUT /daily-reports/:id

`draft` または `rejected` 状態の日報のみ更新可能。作成者本人のみ操作可能。

**リクエスト**（変更する項目のみ指定可）

```json
{
  "problem": "更新後の課題テキスト",
  "plan": "更新後のプランテキスト"
}
```

**レスポンス** `200 OK`

GET /daily-reports/:id と同形式。

---

### POST /daily-reports/:id/submit

日報を提出する。`draft` または `rejected` 状態のみ操作可能。
訪問記録が0件の場合は 400 を返す。

**リクエスト** なし

**レスポンス** `200 OK`

```json
{
  "data": {
    "id": 1,
    "status": "submitted",
    "updated_at": "2026-03-16T18:30:00Z"
  }
}
```

---

### POST /daily-reports/:id/approve

日報を承認する。`submitted` 状態のみ操作可能。managerのみ実行可能。

**リクエスト** なし

**レスポンス** `200 OK`

```json
{
  "data": {
    "id": 1,
    "status": "approved",
    "approved_by": {
      "id": 5,
      "name": "山田 部長"
    },
    "approved_at": "2026-03-17T09:00:00Z",
    "updated_at": "2026-03-17T09:00:00Z"
  }
}
```

---

### POST /daily-reports/:id/reject

日報を差し戻す。`submitted` 状態のみ操作可能。managerのみ実行可能。

**リクエスト** なし

**レスポンス** `200 OK`

```json
{
  "data": {
    "id": 1,
    "status": "rejected",
    "updated_at": "2026-03-17T09:05:00Z"
  }
}
```

---

## 訪問記録

### POST /daily-reports/:id/visit-records

訪問記録を追加する。日報が `draft` または `rejected` 状態の場合のみ可能。

**リクエスト**

```json
{
  "customer_id": 30,
  "visit_time": "16:00",
  "purpose": "契約更新の打ち合わせ",
  "case_product": "サポート契約",
  "next_action": "契約書を郵送"
}
```

**レスポンス** `201 Created`

```json
{
  "data": {
    "id": 5,
    "daily_report_id": 1,
    "customer_id": 30,
    "customer_name": "有限会社C",
    "visit_time": "16:00",
    "purpose": "契約更新の打ち合わせ",
    "case_product": "サポート契約",
    "next_action": "契約書を郵送",
    "created_at": "2026-03-16T19:00:00Z",
    "updated_at": "2026-03-16T19:00:00Z"
  }
}
```

---

### PUT /visit-records/:id

**リクエスト**（変更する項目のみ指定可）

```json
{
  "purpose": "更新後の訪問目的",
  "next_action": "更新後のアクション"
}
```

**レスポンス** `200 OK`

POST /daily-reports/:id/visit-records と同形式。

---

### DELETE /visit-records/:id

**レスポンス** `204 No Content`

---

## コメント

### GET /daily-reports/:id/comments

**クエリパラメータ**

| パラメータ  | 型     | 必須 | 説明                               |
| ----------- | ------ | ---- | ---------------------------------- |
| target_type | string | -    | `problem` / `plan`（省略時は両方） |

**レスポンス** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "target_type": "problem",
      "content": "来週の営業会議で相談しましょう。",
      "user": {
        "id": 5,
        "name": "山田 部長"
      },
      "created_at": "2026-03-16T19:30:00Z"
    }
  ]
}
```

---

### POST /daily-reports/:id/comments

**リクエスト**

```json
{
  "target_type": "problem",
  "content": "来週の営業会議で相談しましょう。"
}
```

**レスポンス** `201 Created`

```json
{
  "data": {
    "id": 1,
    "daily_report_id": 1,
    "target_type": "problem",
    "content": "来週の営業会議で相談しましょう。",
    "user": {
      "id": 5,
      "name": "山田 部長"
    },
    "created_at": "2026-03-16T19:30:00Z"
  }
}
```

---

## 顧客マスタ

### GET /customers

**クエリパラメータ**

| パラメータ | 型     | 必須 | 説明                           |
| ---------- | ------ | ---- | ------------------------------ |
| q          | string | -    | 会社名・担当者名の部分一致検索 |

**レスポンス** `200 OK`

```json
{
  "data": [
    {
      "id": 10,
      "company_name": "株式会社A",
      "contact_name": "鈴木 一郎",
      "phone": "03-1234-5678",
      "email": "suzuki@company-a.com",
      "address": "東京都千代田区..."
    }
  ]
}
```

---

### POST /customers

**リクエスト**

```json
{
  "company_name": "株式会社D",
  "contact_name": "佐々木 次郎",
  "phone": "06-9876-5432",
  "email": "sasaki@company-d.com",
  "address": "大阪府大阪市..."
}
```

**レスポンス** `201 Created`

GET /customers と同形式の単一オブジェクト。

---

### PUT /customers/:id

**リクエスト**（変更する項目のみ指定可）

```json
{
  "phone": "06-1111-2222"
}
```

**レスポンス** `200 OK`

GET /customers と同形式の単一オブジェクト。

---

### DELETE /customers/:id

**レスポンス** `204 No Content`

---

## ユーザーマスタ

### GET /users

**レスポンス** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "name": "田中 太郎",
      "email": "tanaka@example.com",
      "role": "sales",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /users

**リクエスト**

```json
{
  "name": "新人 花子",
  "email": "shinjin@example.com",
  "password": "initialPass123",
  "role": "sales"
}
```

**レスポンス** `201 Created`

GET /users と同形式の単一オブジェクト（`password` は返却しない）。

---

### PUT /users/:id

**リクエスト**（変更する項目のみ指定可。パスワードリセット時は `password` を指定）

```json
{
  "name": "田中 太郎（改）",
  "role": "manager",
  "password": "newPassword456"
}
```

**レスポンス** `200 OK`

GET /users と同形式の単一オブジェクト。
