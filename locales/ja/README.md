# 日文公開版の管理

保守上の基準は `skills/taskobo-diagrams/` と `examples/pm-update-zh-CN/` の中国語版だ。Taskoboの日本語サイトが配布するのは、この基準に追従する**日本語版**である。保守言語と配布言語を混同しない。

`runtime.tsv` は共通スクリプト内の表示文字列、`demo.tsv` は教材JSONの値、`skill/` は日本語の指示・説明・議事録を保持する。処理ロジック、JSONキー、schema、ID、日付、RACIコードは共通だ。未翻訳の新しい表示文字列や教材値があればビルドを停止する。

```sh
python scripts/build-pm-skill-ja.py --node /path/to/node --browser /path/to/chrome --out /path/to/new-build
python scripts/build-pm-skill-ja.py --check
node scripts/check-pm-skill-ja.mjs
```

ビルドは一時的な新ディレクトリへ共通コードと翻訳を展開し、日本語の紀要から2回の更新を再実行する。引用照合とハッシュは日本語ファイルから再計算する。中国語版の生成済みハッシュやレビューを流用しない。各作業のID・日付・責任コードを基準版と比較した後、全図を描画し、日本語ZIPとSHA-256を生成する。

公開物は `docs/downloads/taskobo-diagrams-ja.zip`。以前の中国語ZIPと図表サンプルZIPは履歴・別用途として保持する。日本語版も初期公開段階であり、対応範囲は共通コア0.1.3と同じだ。翻訳で機能の成熟度を変更したとは扱わない。
