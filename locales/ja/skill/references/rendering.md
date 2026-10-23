# 初期化・ページ分割・描画診断

## 通常の計画から始める

```sh
node scripts/pm.mjs init --from /path/to/plan.md --out /path/to/draft --name プロジェクト名 --as-of 2026-10-21
```

UTF-8 CSVは、引用符内のカンマ・改行とBOMに対応する。ExcelはCSV UTF-8として保存する。Word／PDFはAI環境でテキストを抽出する。Markdownはタスク表一つを扱い、表が複数ある場合は対象を分ける。表がない場合は全文を保持し、AIが事実を整理する。`--from` を省略すると空テンプレートを取得できる。

`draft.json`、`questions.md`、`plan-template.csv` を生成する。原文、列値、出典SHA-256を保持する。担当者をA／Rに自動変換せず、日付を補わず、予定を承認済み基準と扱わない。不足を確認して `project.json` に整理し、`check` 後に描画する。草稿 `taskobo.pm-draft/v1` は直接描画できない。

## 大規模案件と反復更新

```sh
node scripts/render.mjs --project /path/to/project.json --out /path/to/preview
node scripts/render.mjs --project /path/to/project.json --out /path/to/preview --force
node scripts/render.mjs --project /path/to/project.json --out /path/to/filtered --group delivery --from 2026-10-01 --to 2026-11-30 --page-size 8
node scripts/render.mjs --project /path/to/project.json --out /path/to/svg --format svg
node scripts/render.mjs --project /path/to/project.json --out /path/to/sources --format sources
```

- 上限は300作業パッケージ、32役割。既定では1グループ・1ページ12作業、`--page-size` は1–20。工程表とRACIは同じ作業範囲で分け、WBSはさらに1図最大4作業に分割して親子の包含関係を保つ。
- RACIは1ページ最大8役割で作業列を繰り返す。最終責任者が一人、実行担当者が一人以上であることを全体で検証する。個別ページにA／Rが見えない場合があるため、全ページを合わせて読む。ソースJSONには全役割を保持する。
- 依存関係図は既定で1ページ12本、ページサイズに応じて最大16本。選択タスクの明示的な `dependsOn` をすべて表示する。別グループ、選択範囲外、アーカイブ済みの先行作業もIDと注記で示す。クリティカルパス計算や自動再配置は行わない。
- 長い名称と受入条件は短く表示し、全文は明細とスナップショットに残す。期間の絞込みで基準・予測・依存関係を変更しない。
- 予測終了日が集計基準日より前でも元の日付を保持し、「予測期限切れ・要更新」を示す。自動延長や完了扱いはしない。
- PNGは最大3,200万画素、1辺16,384画素。必要なら縮小する。SVGは元のベクトル寸法を保持する。
- `--force` は本ツールの生成物で、ハッシュが一致し、追加ファイルやシンボリックリンクがない出力先だけを更新する。新結果が完全に生成されてから置換する。一部失敗は `.failed-…` に保存し、前の成功結果を保持する。`review` と `accept` は引き続き新しいパスを使う。
- `--format sources` はブラウザー不要で、ソース、スナップショット、レビュー文を出力する。図形の描画は検証しない。SVG／PNGには導入済みのChrome／Edgeが必要だ。

## 失敗を見分ける

終了コードは `0` が選択形式の全処理成功、`2` が一部失敗、`1` が入力・出力・環境のエラーだ。ファイルの存在だけで判断せず、`report.json.status` を確認する。

`diagnostics.json` に図ID、作業ID、ソース長、処理段階、エラーコード、ブラウザー版、終了状態、ログを記録する。ブラウザー未導入、起動失敗、切断、タイムアウトを区別する。メモリー不足はログで明示された場合だけ判定する。既定の1図タイムアウトは180秒、`--timeout` は1000–300000ミリ秒だ。

失敗した図のソースを保持する。PNGだけが失敗した場合は有効なSVGを残し、一部失敗と表示する。ページサイズを小さくする、グループで絞る、`--format svg` を使う方法がある。エラー表示用の図を業務図として保存しない。

```sh
node scripts/render.mjs --doctor
node scripts/render.mjs --verify --out /path/to/preview
```

`--doctor` はNode、runtime、ブラウザーパスを調べるが、ブラウザー実行の成功は保証しない。`--verify` はファイル整合性と出力状態を示す。ハッシュ一致は業務上の正しさを証明せず、ソースのみの出力は描画成功を意味しない。
