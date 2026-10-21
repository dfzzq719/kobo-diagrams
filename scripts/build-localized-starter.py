#!/usr/bin/env python3
"""Build deterministic English/Japanese example ZIPs from reviewed sources."""
from pathlib import Path
from html import escape
import hashlib, json, sys, zipfile

ROOT=Path(__file__).resolve().parents[1]
GUIDES={
'en':('''Taskobo Diagrams — English diagram examples

Let AI handle the document work, so PMs can focus on judgment, communication and delivery.

1. Open index.html to view four complete diagrams. Viewing needs no development environment.
2. Give your AI the project facts, editable sources and AI-TASK.txt.
3. Review missing facts, assumptions, owners, dates and acceptance criteria.
4. Render the revised sources with the companion styling tool, then continue editing and exporting through its DOCSKOBO link.

Styling tool (currently Japanese UI): https://taskobo.com/free-tools/mermaid/
Document workspace: https://docskobo.com/app
Project: https://github.com/dfzzq719/taskobo-diagrams
Taskobo: https://taskobo.com/

All four examples describe one fictional CRM service rollout, status date 2026-10-14.
This archive includes complete PNGs, SVGs and editable sources, with no AI service or key.
It is a diagram starter, separate from the current Chinese Alpha Skill and its two-meeting teaching demo.
''','''Act as a project-management assistant. Use the project facts I provide and the four supplied formats to help organize the material.

First list missing facts, assumptions and conflicts. Once confirmed, produce four editable sources:
- WBS: deliverables and testable acceptance conditions.
- RACI: clear accountability, execution, consultation and information; one accountable owner and an execution role for every activity.
- Change flow: assessment, approval, deferral, rejection, independent verification and business acceptance; unmet conditions stay pending.
- Schedule: distinguish approved baselines, actual finishes, forecasts and unapproved plans; check dates and dependencies.

Keep the supplied syntax, status and date conventions. Replace the fictional facts with the facts I have confirmed. Do not fill gaps with sample values. Explain the changes and their evidence so the team can review them.

My project facts:
[Add objectives, scope, roles, dates, open issues and recorded decisions here.]
'''),
'ja':('''Taskobo Diagrams — 日本語の図表サンプル

煩雑な資料整理をAIに任せ、PMは判断、対話、成果の実現に集中する。

1. index.htmlを開き、4種類の全体図を確認する。閲覧に開発環境は不要だ。
2. プロジェクトの事実、編集用ソース、AI-TASK.txtを普段のAIに渡す。
3. 不足情報、仮定、責任者、日付、受入条件を確認する。
4. スタイルツールで修正後のソースを描画し、ツール内のDOCSKOBOリンクから編集と出力を続ける。

スタイルツール（現在は日本語画面）：https://taskobo.com/free-tools/mermaid/
文書ワークスペース：https://docskobo.com/app
プロジェクト：https://github.com/dfzzq719/taskobo-diagrams
Taskobo：https://taskobo.com/

4種類とも同じ架空の顧客サービスシステム導入事例を扱う。集計基準日は2026-10-14だ。
全体のPNG、SVG、編集用ソースを含み、AIサービスやキーは含まない。
図表のサンプルパックであり、現在の中国語Alpha Skillと2回の会議を扱う教材とは別のものだ。
''','''プロジェクト管理の補助役として、提供する事実と4つの書式例に基づき資料を整理する。

最初に不足情報、仮定、矛盾を示す。確認後、4種類の編集用ソースを作成する。
- WBS：成果物と検証可能な受入条件に分解する。
- RACI：最終責任、実行、相談、報告を明確にし、各活動に一つの最終責任と実行責任を置く。
- 変更フロー：評価、承認、延期、却下、独立検証、業務受入れを保持する。条件未達の分岐は保留する。
- 工程表：承認済み基準、完了実績、予測、未承認計画を分け、日付と前提関係を照合する。

同梱例の構造、状態、日付の規則を保ち、確認済みの事実に置き換える。不足情報を例示値で埋めない。変更と根拠を簡潔に示し、チームがレビューできるようにする。

対象プロジェクトの事実：
【目的、範囲、役割、日付、未解決課題、記録済み判断をここに記入する】
''')}

def main():
    if len(sys.argv)<2 or sys.argv[1] not in GUIDES or sys.argv[2:] not in ([],['--check']):
        raise SystemExit('Usage: python scripts/build-localized-starter.py en|ja [--check]')
    locale=sys.argv[1]
    copy=json.loads((ROOT/f'examples/project-case/presentation/{locale}.json').read_text(encoding='utf-8'))
    sources=ROOT/'examples/project-case'/('' if locale=='en' else locale)
    assets=ROOT/f'docs/assets/crm-case/{locale}'
    prefix=f'Taskobo-Diagrams-Examples-{locale}/'
    files={'README.txt':GUIDES[locale][0].encode('utf-8-sig'),'AI-TASK.txt':GUIDES[locale][1].encode('utf-8-sig'),'LICENSE.txt':(ROOT/'LICENSE').read_bytes()}
    sections=[]
    for doc in copy['documents']:
        stem=doc['id']
        files[f'sources/{doc["file"]}']=(sources/doc['file']).read_bytes().replace(b'\r\n',b'\n')
        files[f'images/{stem}.png']=(assets/f'{stem}-figure.png').read_bytes()
        files[f'vectors/{stem}.svg']=(assets/f'{stem}.svg').read_bytes().replace(b'\r\n',b'\n')
        sections.append(f'<section><h2>{escape(doc["title"])}</h2><p>{escape(doc["description"])}</p><a href="vectors/{stem}.svg"><img src="images/{stem}.png" alt="{escape(doc["title"])}"></a><p><a href="sources/{doc["file"]}">{escape(copy["sourceLabel"])}</a></p></section>')
    files['index.html']=(f'<!doctype html><html lang="{locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(copy["title"])}</title><style>*{{box-sizing:border-box}}body{{max-width:1200px;margin:auto;padding:24px;background:#fffefa;color:#0d2046;font:18px/1.7 "Yu Gothic",Meiryo,Arial,sans-serif}}img{{display:block;width:100%;height:auto}}section{{margin-top:40px;border-top:1px solid #d7dce6;padding-top:20px}}a{{color:#1456d9}}</style><h1>{escape(copy["title"])}</h1><p>{escape(copy["caseCaption"].replace("{date}","2026-10-14"))} · <a href="README.txt">README</a></p>'+''.join(sections)+'</html>\n').encode('utf-8')
    files={prefix+name:data for name,data in files.items()}
    output=ROOT/f'docs/downloads/taskobo-diagrams-examples-{locale}.zip'
    if '--check' in sys.argv:
        with zipfile.ZipFile(output) as z:
            if sorted(z.namelist())!=sorted(files) or any(z.read(n)!=b for n,b in files.items()):raise SystemExit('Archive differs; rebuild '+locale)
    else:
        with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
            for name,data in sorted(files.items()):
                info=zipfile.ZipInfo(name,date_time=(2026,10,21,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
    digest=hashlib.sha256(output.read_bytes()).hexdigest()
    checksum=output.with_suffix('.zip.sha256')
    expected=f'{digest}  {output.name}\n'
    if '--check' in sys.argv:
        if checksum.read_text(encoding='ascii')!=expected:raise SystemExit('Checksum differs')
    else:checksum.write_text(expected,encoding='ascii')
    print(json.dumps({'locale':locale,'verified':'--check' in sys.argv,'files':len(files),'sha256':digest}))
if __name__=='__main__':main()
