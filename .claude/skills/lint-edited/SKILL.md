---
name: lint-edited
description: エージェントがファイルを編集した後、編集済みファイルに対してLinter（ESLint・Prettier）を実行する。編集作業の仕上げとして使う。
argument-hint: [--fix]
---

直近でエージェントが編集したファイルに対してLinterを実行してください。

## 手順

### 1. 編集済みファイルの特定

`git status --porcelain` を実行して変更されたファイルを取得する。削除ファイル（先頭が `D`）は除外する。

### 2. 対象ファイルのフィルタリング

以下の拡張子のみを対象にする：`.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs`

### 3. Linterの実行

対象ファイルがある場合、以下の順で実行する。

**ESLint**（`eslint.config.mjs` が存在する場合）

- 通常: `npx eslint <対象ファイル>`
- `$ARGUMENTS` に `--fix` が含まれる場合: `npx eslint --fix <対象ファイル>`

**Prettier**（`.prettierrc` または `prettier` の設定が `package.json` に存在する場合）

- 通常: `npx prettier --check <対象ファイル>`
- `$ARGUMENTS` に `--fix` が含まれる場合: `npx prettier --write <対象ファイル>`

### 4. 結果の報告

- エラー・警告があればファイル名と内容を表示する
- すべてクリーンなら「Lintエラーなし」と報告する
- `--fix` モードの場合は修正したファイルと修正内容を報告する
- 変更済みファイルが存在しない場合は「変更済みファイルがありません」と報告して終了する
