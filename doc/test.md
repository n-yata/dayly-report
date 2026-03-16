# 営業日報システム テスト仕様書

## テスト方針

- APIレベルのテストを中心に、画面操作観点のE2Eテストも定義する
- 正常系・異常系・権限テストを網羅する
- ステータス遷移は全パターンを検証する

## テストケースID体系

| プレフィックス | 対象            |
| -------------- | --------------- |
| AUTH           | 認証            |
| RPT            | 日報            |
| VST            | 訪問記録        |
| CMT            | コメント        |
| CST            | 顧客マスタ      |
| USR            | ユーザーマスタ  |
| E2E            | 画面操作（E2E） |

---

## AUTH：認証

| ID       | テストケース                | 前提条件                   | 操作                                       | 期待結果                 |
| -------- | --------------------------- | -------------------------- | ------------------------------------------ | ------------------------ |
| AUTH-001 | 正常ログイン                | 登録済みユーザーが存在する | 正しいメール・パスワードでPOST /auth/login | 200、tokenとuserが返る   |
| AUTH-002 | パスワード誤り              | 登録済みユーザーが存在する | 誤ったパスワードでPOST /auth/login         | 401 UNAUTHORIZED         |
| AUTH-003 | 存在しないメール            |                            | 未登録のメールでPOST /auth/login           | 401 UNAUTHORIZED         |
| AUTH-004 | メール未入力                |                            | emailを空でPOST /auth/login                | 400 VALIDATION_ERROR     |
| AUTH-005 | パスワード未入力            |                            | passwordを空でPOST /auth/login             | 400 VALIDATION_ERROR     |
| AUTH-006 | 正常ログアウト              | ログイン済み               | POST /auth/logout                          | 200、tokenが無効化される |
| AUTH-007 | トークンなしでAPIアクセス   |                            | Authorizationヘッダーなしでリソース取得    | 401 UNAUTHORIZED         |
| AUTH-008 | 無効なトークンでAPIアクセス |                            | 不正なtokenでリソース取得                  | 401 UNAUTHORIZED         |

---

## RPT：日報

### 一覧取得

| ID      | テストケース                     | 前提条件                               | 操作                                | 期待結果                   |
| ------- | -------------------------------- | -------------------------------------- | ----------------------------------- | -------------------------- |
| RPT-001 | salesは自分の日報のみ取得できる  | sales・managerそれぞれの日報が存在する | salesユーザーでGET /daily-reports   | 自分の日報のみ返る         |
| RPT-002 | managerは全員の日報を取得できる  | 複数ユーザーの日報が存在する           | managerユーザーでGET /daily-reports | 全ユーザーの日報が返る     |
| RPT-003 | 期間フィルターが機能する         | 複数日の日報が存在する                 | ?from=2026-03-01&to=2026-03-15      | 指定期間の日報のみ返る     |
| RPT-004 | user_idフィルター（manager専用） | 複数ユーザーの日報が存在する           | managerで?user_id=1                 | 指定ユーザーの日報のみ返る |
| RPT-005 | salesがuser_idフィルターを使用   |                                        | salesで?user_id=2                   | 403 FORBIDDEN              |
| RPT-006 | statusフィルターが機能する       | 各ステータスの日報が存在する           | ?status=submitted                   | submitted の日報のみ返る   |

### 作成

| ID      | テストケース             | 前提条件                    | 操作                              | 期待結果                           |
| ------- | ------------------------ | --------------------------- | --------------------------------- | ---------------------------------- |
| RPT-010 | 正常作成（下書き）       | salesユーザーでログイン済み | 必須項目を含むPOST /daily-reports | 201、status=draft で作成される     |
| RPT-011 | 訪問記録なしで作成       |                             | visit_records を空配列でPOST      | 201、visit_recordsが空で作成される |
| RPT-012 | 同日の日報が既に存在する | 同日にdraftの日報が存在する | 同じreport_dateでPOST             | 409 CONFLICT                       |
| RPT-013 | report_date未入力        |                             | report_dateを省略してPOST         | 400 VALIDATION_ERROR               |
| RPT-014 | managerが日報作成        | managerでログイン済み       | POST /daily-reports               | 403 FORBIDDEN                      |

### 詳細取得

| ID      | テストケース              | 前提条件                   | 操作                    | 期待結果            |
| ------- | ------------------------- | -------------------------- | ----------------------- | ------------------- |
| RPT-020 | salesが自分の日報を取得   | salesの日報が存在する      | GET /daily-reports/:id  | 200、日報詳細が返る |
| RPT-021 | salesが他人の日報を取得   | 別ユーザーの日報が存在する | 別ユーザーの日報IDでGET | 403 FORBIDDEN       |
| RPT-022 | managerが任意の日報を取得 | 任意の日報が存在する       | GET /daily-reports/:id  | 200、日報詳細が返る |
| RPT-023 | 存在しない日報を取得      |                            | 存在しないIDでGET       | 404 NOT_FOUND       |

### 更新

| ID      | テストケース              | 前提条件                        | 操作                   | 期待結果                  |
| ------- | ------------------------- | ------------------------------- | ---------------------- | ------------------------- |
| RPT-030 | draft状態の日報を更新     | 自分のdraft日報が存在する       | PUT /daily-reports/:id | 200、更新内容が反映される |
| RPT-031 | rejected状態の日報を更新  | 自分のrejected日報が存在する    | PUT /daily-reports/:id | 200、更新内容が反映される |
| RPT-032 | submitted状態の日報を更新 | 自分のsubmitted日報が存在する   | PUT /daily-reports/:id | 400 VALIDATION_ERROR      |
| RPT-033 | approved状態の日報を更新  | 自分のapproved日報が存在する    | PUT /daily-reports/:id | 400 VALIDATION_ERROR      |
| RPT-034 | 他人の日報を更新          | 別ユーザーのdraft日報が存在する | PUT /daily-reports/:id | 403 FORBIDDEN             |

### ステータス遷移

| ID      | テストケース                   | 前提条件                   | 操作                                     | 期待結果                                                   |
| ------- | ------------------------------ | -------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| RPT-040 | draft→submitted（提出）        | 訪問記録1件以上のdraft日報 | POST /daily-reports/:id/submit           | 200、status=submitted                                      |
| RPT-041 | 訪問記録0件での提出            | 訪問記録なしのdraft日報    | POST /daily-reports/:id/submit           | 400 VALIDATION_ERROR                                       |
| RPT-042 | submitted→approved（承認）     | submitted日報が存在する    | managerがPOST /daily-reports/:id/approve | 200、status=approved、approved_by・approved_atが記録される |
| RPT-043 | submitted→rejected（差し戻し） | submitted日報が存在する    | managerがPOST /daily-reports/:id/reject  | 200、status=rejected                                       |
| RPT-044 | rejected→submitted（再提出）   | rejected日報が存在する     | POST /daily-reports/:id/submit           | 200、status=submitted                                      |
| RPT-045 | approved日報を提出             | approved日報が存在する     | POST /daily-reports/:id/submit           | 400 VALIDATION_ERROR                                       |
| RPT-046 | salesが承認操作                | submitted日報が存在する    | salesがPOST /daily-reports/:id/approve   | 403 FORBIDDEN                                              |
| RPT-047 | salesが差し戻し操作            | submitted日報が存在する    | salesがPOST /daily-reports/:id/reject    | 403 FORBIDDEN                                              |
| RPT-048 | draft日報を承認                | draft日報が存在する        | managerがPOST /daily-reports/:id/approve | 400 VALIDATION_ERROR                                       |

---

## VST：訪問記録

| ID      | テストケース                  | 前提条件                              | 操作                                    | 期待結果                  |
| ------- | ----------------------------- | ------------------------------------- | --------------------------------------- | ------------------------- |
| VST-001 | 正常追加                      | 自分のdraft日報、顧客マスタが存在する | POST /daily-reports/:id/visit-records   | 201、訪問記録が追加される |
| VST-002 | submitted日報に訪問記録追加   | submitted日報が存在する               | POST /daily-reports/:id/visit-records   | 400 VALIDATION_ERROR      |
| VST-003 | 他人の日報に訪問記録追加      | 別ユーザーのdraft日報が存在する       | POST /daily-reports/:id/visit-records   | 403 FORBIDDEN             |
| VST-004 | 存在しない顧客IDを指定        |                                       | customer_idに存在しないIDを指定してPOST | 400 VALIDATION_ERROR      |
| VST-005 | 必須項目（customer_id）未入力 |                                       | customer_idを省略してPOST               | 400 VALIDATION_ERROR      |
| VST-006 | 必須項目（visit_time）未入力  |                                       | visit_timeを省略してPOST                | 400 VALIDATION_ERROR      |
| VST-007 | 必須項目（purpose）未入力     |                                       | purposeを省略してPOST                   | 400 VALIDATION_ERROR      |
| VST-008 | 正常更新                      | 自分のdraft日報の訪問記録が存在する   | PUT /visit-records/:id                  | 200、更新内容が反映される |
| VST-009 | 他人の訪問記録を更新          | 別ユーザーの訪問記録が存在する        | PUT /visit-records/:id                  | 403 FORBIDDEN             |
| VST-010 | 正常削除                      | 自分のdraft日報の訪問記録が存在する   | DELETE /visit-records/:id               | 204                       |
| VST-011 | submitted日報の訪問記録を削除 | submitted日報の訪問記録が存在する     | DELETE /visit-records/:id               | 400 VALIDATION_ERROR      |
| VST-012 | 他人の訪問記録を削除          | 別ユーザーの訪問記録が存在する        | DELETE /visit-records/:id               | 403 FORBIDDEN             |

---

## CMT：コメント

| ID      | テストケース                        | 前提条件                          | 操作                                                           | 期待結果                  |
| ------- | ----------------------------------- | --------------------------------- | -------------------------------------------------------------- | ------------------------- |
| CMT-001 | salesがproblemにコメント投稿        | 日報が存在する                    | salesでPOST /daily-reports/:id/comments（target_type=problem） | 201、コメントが作成される |
| CMT-002 | salesがplanにコメント投稿           | 日報が存在する                    | salesでPOST（target_type=plan）                                | 201、コメントが作成される |
| CMT-003 | managerがコメント投稿               | 日報が存在する                    | managerでPOST                                                  | 201、コメントが作成される |
| CMT-004 | target_type未入力                   |                                   | target_typeを省略してPOST                                      | 400 VALIDATION_ERROR      |
| CMT-005 | 不正なtarget_typeを指定             |                                   | target_type="invalid"でPOST                                    | 400 VALIDATION_ERROR      |
| CMT-006 | content未入力                       |                                   | contentを空でPOST                                              | 400 VALIDATION_ERROR      |
| CMT-007 | コメント一覧取得（全件）            | problemとplanにコメントが存在する | GET /daily-reports/:id/comments                                | 200、全コメントが返る     |
| CMT-008 | target_typeフィルター               | problemとplanにコメントが存在する | GET ?target_type=problem                                       | problemのコメントのみ返る |
| CMT-009 | 他人の日報のコメント取得（sales）   | 別ユーザーの日報が存在する        | salesで別ユーザーの日報のコメントGET                           | 403 FORBIDDEN             |
| CMT-010 | 他人の日報のコメント取得（manager） | 別ユーザーの日報が存在する        | managerで別ユーザーの日報のコメントGET                         | 200                       |

---

## CST：顧客マスタ

| ID      | テストケース            | 前提条件              | 操作                           | 期待結果                  |
| ------- | ----------------------- | --------------------- | ------------------------------ | ------------------------- |
| CST-001 | 顧客一覧取得（sales）   | 顧客が存在する        | salesでGET /customers          | 200、顧客一覧が返る       |
| CST-002 | 顧客一覧取得（manager） | 顧客が存在する        | managerでGET /customers        | 200、顧客一覧が返る       |
| CST-003 | 名前検索                | 顧客が複数存在する    | GET /customers?q=株式会社      | 一致する顧客のみ返る      |
| CST-004 | 正常登録                | managerでログイン済み | 必須項目を含むPOST /customers  | 201、顧客が作成される     |
| CST-005 | salesが顧客登録         | salesでログイン済み   | POST /customers                | 403 FORBIDDEN             |
| CST-006 | company_name未入力      |                       | company_nameを省略してPOST     | 400 VALIDATION_ERROR      |
| CST-007 | contact_name未入力      |                       | contact_nameを省略してPOST     | 400 VALIDATION_ERROR      |
| CST-008 | 正常更新                | 顧客が存在する        | managerでPUT /customers/:id    | 200、更新内容が反映される |
| CST-009 | salesが顧客更新         |                       | salesでPUT /customers/:id      | 403 FORBIDDEN             |
| CST-010 | 存在しない顧客を更新    |                       | 存在しないIDでPUT              | 404 NOT_FOUND             |
| CST-011 | 正常削除                | 顧客が存在する        | managerでDELETE /customers/:id | 204                       |
| CST-012 | salesが顧客削除         |                       | salesでDELETE /customers/:id   | 403 FORBIDDEN             |

---

## USR：ユーザーマスタ

| ID      | テストケース                | 前提条件                     | 操作                              | 期待結果                                      |
| ------- | --------------------------- | ---------------------------- | --------------------------------- | --------------------------------------------- |
| USR-001 | ユーザー一覧取得（manager） | ユーザーが存在する           | managerでGET /users               | 200、ユーザー一覧が返る（passwordは含まない） |
| USR-002 | ユーザー一覧取得（sales）   |                              | salesでGET /users                 | 403 FORBIDDEN                                 |
| USR-003 | 正常登録                    | managerでログイン済み        | 必須項目を含むPOST /users         | 201、ユーザーが作成される                     |
| USR-004 | salesがユーザー登録         |                              | salesでPOST /users                | 403 FORBIDDEN                                 |
| USR-005 | name未入力                  |                              | nameを省略してPOST                | 400 VALIDATION_ERROR                          |
| USR-006 | email未入力                 |                              | emailを省略してPOST               | 400 VALIDATION_ERROR                          |
| USR-007 | 重複メールアドレスで登録    | 同メールのユーザーが存在する | 同じemailでPOST                   | 409 CONFLICT                                  |
| USR-008 | 不正なロール値で登録        |                              | role="admin"でPOST                | 400 VALIDATION_ERROR                          |
| USR-009 | 正常更新（ロール変更）      | ユーザーが存在する           | managerでrole変更のPUT /users/:id | 200、ロールが変更される                       |
| USR-010 | パスワードリセット          | ユーザーが存在する           | managerでpasswordを含むPUT        | 200、新パスワードでログイン可能               |
| USR-011 | salesがユーザー更新         |                              | salesでPUT /users/:id             | 403 FORBIDDEN                                 |

---

## E2E：画面操作シナリオ

### E2E-001：日報の作成から承認までの一連フロー

**前提条件**: sales ユーザー（田中太郎）、manager ユーザー（山田部長）が存在する

| ステップ | 操作                                                     | 期待結果                                                     |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 1        | 田中太郎でログイン                                       | SCR-002 日報一覧に遷移する                                   |
| 2        | 新規作成ボタンをクリック                                 | SCR-003 日報作成画面に遷移する                               |
| 3        | 報告日を入力し、訪問記録を2件追加してProblem・Planを入力 | 入力内容が画面に反映される                                   |
| 4        | 下書き保存をクリック                                     | SCR-002に遷移し、ステータス「下書き」で一覧に表示される      |
| 5        | 作成した日報をクリック                                   | SCR-004 詳細画面が表示される                                 |
| 6        | 編集ボタンをクリック                                     | SCR-003に遷移し、入力内容が復元される                        |
| 7        | 提出するボタンをクリック                                 | SCR-002に遷移し、ステータスが「提出済」に変わる              |
| 8        | 田中太郎でログアウトし、山田部長でログイン               | SCR-002 日報一覧に遷移する                                   |
| 9        | SCR-005 承認一覧を開く                                   | 田中太郎の提出済日報が表示される                             |
| 10       | 詳細ボタンから田中太郎の日報を開く                       | SCR-004が表示され「承認する」「差し戻す」ボタンが表示される  |
| 11       | Problemにコメントを入力して送信                          | コメントが一覧に追加される                                   |
| 12       | 承認するボタンをクリック                                 | ステータスが「承認済」に変わり、承認者・承認日時が記録される |

---

### E2E-002：差し戻し→修正→再提出フロー

| ステップ | 操作                   | 期待結果                     |
| -------- | ---------------------- | ---------------------------- |
| 1        | salesで日報を提出      | ステータス「提出済」         |
| 2        | managerで差し戻す      | ステータス「差し戻し」       |
| 3        | salesで日報詳細を開く  | 「編集」ボタンが表示される   |
| 4        | 編集→内容修正→提出する | ステータスが「提出済」に戻る |
| 5        | managerで承認する      | ステータスが「承認済」になる |

---

### E2E-003：訪問記録0件での提出はできない

| ステップ | 操作                                    | 期待結果                                 |
| -------- | --------------------------------------- | ---------------------------------------- |
| 1        | salesで日報を作成し訪問記録を追加しない | draft状態で保存                          |
| 2        | 詳細画面から提出するボタンをクリック    | エラーメッセージが表示され提出されない   |
| 3        | 訪問記録を1件追加して再度提出           | 提出に成功しステータスが「提出済」になる |

---

### E2E-004：同日の日報は重複作成できない

| ステップ | 操作                             | 期待結果                     |
| -------- | -------------------------------- | ---------------------------- |
| 1        | 2026-03-16 の日報を作成          | 正常に作成される             |
| 2        | 再度 2026-03-16 の日報を新規作成 | エラーが表示され作成できない |

---

### E2E-005：salesは他人の日報を閲覧・操作できない

| ステップ | 操作                                       | 期待結果                  |
| -------- | ------------------------------------------ | ------------------------- |
| 1        | salesユーザーAで日報一覧を開く             | 自分の日報のみ表示される  |
| 2        | 別ユーザーBの日報IDで直接詳細URLにアクセス | 403エラー画面が表示される |
