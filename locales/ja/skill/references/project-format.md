# プロジェクトと更新の形式

AIが資料を理解して変更案を作り、スクリプトが構造、引用、競合を検証する。PMが選択した変更だけを新状態に保存する。形式検証は資料やAIの理解の正しさ・完全性を証明しない。

## プロジェクト `kobo.pm-project/v1`

```json
{
  "schema": "kobo.pm-project/v1",
  "id": "crm-demo",
  "name": "顧客対応システム導入（独立した架空教材）",
  "statusDate": "2026-10-14",
  "roles": [{"id": "pm", "name": "プロジェクトマネージャー"}],
  "groups": [{"id": "delivery", "name": "成果物"}],
  "tasks": [{
    "id": "WP-01", "title": "導入範囲を確認する", "groupId": "delivery",
    "acceptance": "業務責任者が範囲と受入条件を確認する",
    "responsibilities": {"pm": "A/R"},
    "baseline": {"start": "2026-10-12", "finish": "2026-10-15"},
    "forecast": {"start": "2026-10-12", "finish": "2026-10-15"},
    "actualFinish": null, "status": "active", "dependsOn": []
  }],
  "actions": [], "decisions": [], "appliedUpdates": []
}
```

- `roles` は最大32、`tasks` は最大300。役割・グループ・タスク・アクション・決定事項のIDは、それぞれの種類の中で一意にする。
- IDは日本語・中国語を含む文字列に対応し、最大128文字。ASCIIカンマ、改行、前後の空白、先頭の `--` は使用できない。
- 日付は実在する暦日の `YYYY-MM-DD` とし、開始日は終了日以前とする。暦日を営業日に自動換算しない。
- タスクごとに最終責任者は一人（`A` または `A/R`）、実行担当者は一人以上（`R` または `A/R`）。他は `C`、`I`、空文字列で、省略した役割は未割当てとする。
- タスクの `status` は `planned`、`active`、`done`。完了タスクは集計基準日以前の `actualFinish` が必要で、未完了タスクは `null` とする。
- `dependsOn` は既存タスクIDの配列。重複、自己依存、循環は許可しない。
- `baseline` は承認済み基準、`forecast` は現在の予測だ。通常更新で基準は変更できない。承認済み基準の改訂は別途行い、根拠と版を保持する。
- アクションは `{id,title,ownerRoleId,dueDate,status}`、状態は `open`／`done`。
- 決定事項は `{id,title,status}`、状態は `pending`／`approved`／`rejected`／`deferred`。要判断事項は `pending` とし、明確な承認根拠がある場合だけ `approved` を提案する。

## 更新 `kobo.pm-update/v1`

```json
{
  "schema": "kobo.pm-update/v1", "id": "week-1", "asOf": "2026-10-16",
  "sources": [{"id": "minutes", "file": "minutes.txt"}],
  "changes": [{
    "id": "scope-forecast", "kind": "task.set", "targetId": "WP-01",
    "field": "forecast",
    "expected": {"start": "2026-10-12", "finish": "2026-10-15"},
    "value": {"start": "2026-10-12", "finish": "2026-10-18"},
    "evidence": [{"sourceId": "minutes", "quote": "導入範囲の確認は10月18日まで遅れる見込みだ"}]
  }]
}
```

- 更新IDと変更IDは一意にする。全変更に原文引用を付ける。
- `sources[].file` は更新ファイルからの相対パス。同じディレクトリツリー内のUTF-8テキストだけを扱い、シンボリックリンクも範囲外を指せない。任意で `sha256` を指定できるが、実SHA-256は常に計算・保存する。
- `quote` は原文に逐字で存在する必要がある。実案件の引用は翻訳しない。一致は変更案の妥当性や承認を証明しない。
- `task.set` は `forecast`、`status`、`actualFinish`、`responsibilities`、`title`、`acceptance`、`dependsOn`、`archived` を変更できる。各項目に現在値と完全一致する `expected` が必要だ。同じ更新で同じタスクの同じフィールドを二度変更しない。
- `task.add` の `value` は完全な新作業パッケージだ。根拠、確認済みの承認済み基準、予測、有効な責任分担が必要だ。既存IDを上書きしない。単なる予定日から基準の承認を推定しない。
- `task.set archived=true` は元タスク・基準・根拠・依存関係を保持して、通常の図から除く。未記録時の `expected` は `false`。復元は `false` とする。直接削除する操作はない。
- `action.add` と `decision.add` の `value` は新しいアクション・決定事項だ。`targetId`、`field`、`expected` は付けず、既存IDを上書きしない。
- `action.set` は `title`、`ownerRoleId`、`dueDate`、`status`、`decision.set` は `title`、`status` を更新できる。`task.set` と同じ `targetId`、`field`、`expected`、`value`、`evidence` を使う。安定したIDで継続更新し、毎週重複作成しない。
- `status=done` と `actualFinish` など、同時に有効になるべき変更は一度に選択する。最終状態の検証に失敗した場合は操作全体が失敗する。

## コマンドと結果

SkillディレクトリでNode 22.12+を使う。

```sh
node scripts/pm.mjs check --project project.json
node scripts/pm.mjs review --project project.json --update week/update.json --out week/review
node scripts/pm.mjs accept --project project.json --update week/update.json --select scope-forecast --out project-next.json
```

`review` は新しいディレクトリへ `candidate.json`、`review.json`、`review.md` を生成する。候補は未適用の全提案を含むが、承認済みとは扱わない。`accept` は `--select` で明示したIDだけを適用して新状態を保存する。両方とも入力を保持し、既存出力を上書きしない。レビュー資料は承認証跡ではない。

`appliedUpdates` はツールが管理する：`{id,sha256,asOf,changeIds,sources:[{id,file,sha256}]}`。正規化した更新内容と実出典ハッシュからSHA-256を計算する。フィールド順やJSONの空白では結果は変わらない。同じ更新の適用済み項目は再作成せず、残りの項目を後から適用できる。同じ更新IDで内容や出典が変わった場合は拒否するため、新IDを使う。新たな適用では `expected` と現在値を再照合し、集計基準日の逆行を拒否する。

## プログラム用の関数

`scripts/project.mjs` は次を提供する。

- `validateProject(project)`：検証後に入力を返し、失敗時は例外を投げる。
- `prepareUpdate(project, update, {updatePath})`：出典を非同期で読み取り、`{update,updateHash,sources}` を返す。
- `applyUpdate(project, prepared, selectedIds)`：検証後に深いコピーを返す。入力を変更しない。
- `reviewUpdate(project, prepared)`：候補、適用済み項目、未適用項目、出典を含むレビューを返す。

これらはモデル呼出し、子Agent作成、ネットワーク接続、常駐サービスの起動を行わない。AIの推論は利用中のAIソフトで行う。
