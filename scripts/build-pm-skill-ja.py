#!/usr/bin/env python3
"""Build the Japanese public edition from the Chinese maintenance baseline.

No network, translation service, source-directory writes, or dependency downloads.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'skills/taskobo-diagrams'
LOCALE = ROOT / 'locales/ja'
DOWNLOAD = ROOT / 'docs/downloads/taskobo-diagrams-ja.zip'
RUNS = re.compile(r'[\u3400-\u9fff][\u3400-\u9fff，。、；：（）！？“”「」《》－—… \u3000]*')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_digest(file):
    return digest(file.read_bytes().replace(b'\r\n', b'\n'))


def load(file):
    return json.loads(file.read_text(encoding='utf-8-sig'))


def save(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def catalog(file):
    pairs = {}
    for line in file.read_text(encoding='utf-8').splitlines():
        if not line:
            continue
        before, after = line.split('\t')
        if before in pairs:
            raise SystemExit(f'Duplicate translation: {before}')
        pairs[before] = after
    return pairs


def inputs():
    paths = [p for p in SOURCE.rglob('*') if p.is_file() and 'assets/demo' not in p.relative_to(SOURCE).as_posix()]
    paths += [SOURCE / 'assets/demo' / name for name in ('project.json', 'update-01.json', 'update-02.json', 'profile.json', 'project-brief.md', 'week-01.md', 'week-02.md')]
    paths += [p for p in LOCALE.rglob('*') if p.is_file()]
    paths += [Path(__file__)]
    return {p.relative_to(ROOT).as_posix(): source_digest(p) for p in sorted(paths)}


def check():
    manifest = load(DOWNLOAD.with_suffix('.manifest.json'))
    if manifest['sourceSHA256'] != inputs():
        raise SystemExit('Japanese archive is stale relative to the baseline or translations; rebuild it.')
    checksum = f'{digest(DOWNLOAD.read_bytes())}  {DOWNLOAD.name}\n'
    if DOWNLOAD.with_suffix('.zip.sha256').read_text(encoding='ascii') != checksum:
        raise SystemExit('Archive checksum mismatch')
    with zipfile.ZipFile(DOWNLOAD) as archive:
        actual = {n: digest(archive.read(n)) for n in archive.namelist()}
        if actual != manifest['fileSHA256']:
            raise SystemExit('Archive content mismatch')
    print(json.dumps({'passed': True, 'language': 'ja', 'files': len(actual), 'sha256': digest(DOWNLOAD.read_bytes())}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--node')
    parser.add_argument('--browser')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not args.node or not args.browser or not args.out:
        parser.error('--node, --browser and a new --out directory are required')
    build = args.out.resolve()
    build.mkdir(parents=True, exist_ok=False)
    target = build / 'taskobo-diagrams'
    phrases, values = catalog(LOCALE / 'runtime.tsv'), catalog(LOCALE / 'demo.tsv')
    overrides = load(LOCALE / 'display-overrides.json')

    # Documentation is separately authored; refuse silent drift in its baseline.
    for name, expected in load(LOCALE / 'baseline-docs.json').items():
        if source_digest(SOURCE / name) != expected:
            raise SystemExit(f'Update the Japanese documentation against the changed baseline: {name}')

    def translate(text):
        def replace(match):
            source = match.group().rstrip()
            if source not in phrases:
                raise SystemExit('Missing runtime translation: ' + source)
            return phrases[source] + match.group()[len(source):]
        return RUNS.sub(replace, text)

    for source in sorted(SOURCE.rglob('*')):
        if not source.is_file():
            continue
        relative = source.relative_to(SOURCE)
        if relative.parts[:2] == ('assets', 'demo'):
            continue
        file = target / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        overlay = LOCALE / 'skill' / relative
        if overlay.is_file():
            file.write_bytes(overlay.read_bytes())
        elif relative.parts[0] == 'scripts':
            text = translate(source.read_text(encoding='utf-8'))
            for before, after in overrides.get(relative.name, []):
                if text.count(before) != 1:
                    raise SystemExit(f'Review changed Japanese display text in {relative}: {before}')
                text = text.replace(before, after)
            if relative.name == 'view-model.mjs':
                text = text.replace('lang="zh-CN"', 'lang="ja"').replace("'Microsoft YaHei'", "'Noto Sans JP','Yu Gothic',Meiryo")
            file.write_text(text, encoding='utf-8')
        elif relative.as_posix() == 'assets/runtime-page.mjs':
            text = source.read_text(encoding='utf-8')
            start, end = text.index('function localize('), text.index('function rolePanel(')
            text = text[:start] + text[end:]
            text = text.replace("stage='中文图例与分页';progress();localize(svg,job.kind,job.statusDate);", "progress();")
            text = translate(text)
            text = (LOCALE / 'schedule-legend.mjs').read_text(encoding='utf-8') + '\n' + text
            marker = "if(job.rolePanel){"
            if text.count(marker) != 1:
                raise SystemExit('Review the changed runtime page before applying the JA schedule legend')
            text = text.replace(marker, "if(job.kind==='schedule')localizeSchedule(svg,job.statusDate);\n    " + marker)
            file.write_text(text, encoding='utf-8')
        elif relative.as_posix() == 'assets/runner.html':
            file.write_text(source.read_text(encoding='utf-8').replace('lang="zh-CN"', 'lang="ja"'), encoding='utf-8')
        else:
            file.write_bytes(source.read_bytes())

    # Preserve the shared runtime/core byte-for-byte, including its native JA legends.
    demo = target / 'assets/demo'
    demo.mkdir()
    def localize(value):
        if isinstance(value, dict):
            return {k: localize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [localize(v) for v in value]
        if isinstance(value, str) and RUNS.search(value):
            if value not in values:
                raise SystemExit('Missing teaching-data translation: ' + value)
            return values[value]
        return value
    for name in ('project.json', 'update-01.json', 'update-02.json', 'profile.json'):
        save(demo / name, localize(load(SOURCE / 'assets/demo' / name)))
    for name in ('week-01.md', 'week-02.md'):
        shutil.copyfile(LOCALE / 'skill/assets/demo' / name, demo / name)
    project = load(demo / 'project.json')
    brief = '''# プロジェクト説明｜独立した架空教材

顧客対応システムの初版導入を扱う独立した架空教材だ。業務窓口3、利用者40人、移行データ20,000件。元のCRMギャラリーと名称を共有するが、日程・責任とその後の出来事はこの教材の設定だ。ギャラリーの未承認の本導入計画を変更しない。

18作業パッケージ、6成果物グループ、8役割をproject.jsonに登録し、初期の集計基準日は2026-10-14とする。baselineはこの教材での承認済み基準、forecastは現在の予測だ。受入条件と完了記録を区別する。

2回の議事録は遅延予測、完了根拠、要員不足、未承認範囲を含む。update-01.jsonとupdate-02.jsonは、各引用を照合できるように作成した手動レビュー済みのテスト入力であり、モデルを実際に呼び出した記録ではない。

再実行では教材の変更を明示的に選択する。要判断事項の登録は範囲の承認ではない。実案件は利用者の依頼と権限に従う。

| 作業ID | 成果物 | 承認済み基準の完了日 | 現在の完了予測 |
| --- | --- | --- | --- |
'''
    for task in project['tasks']:
        brief += f"| {task['id']} | {task['title']} | {task['baseline']['finish']} | {task['forecast']['finish']} |\n"
    (demo / 'project-brief.md').write_text(brief, encoding='utf-8')

    def run(script, *argv):
        result = subprocess.run([args.node, str(target / 'scripts' / script), *map(str, argv)], cwd=build, capture_output=True, encoding='utf-8', timeout=240)
        with (build / 'replay.log').open('a', encoding='utf-8') as log:
            log.write(result.stdout + result.stderr)
        if result.returncode:
            raise SystemExit(f'{script} failed: {result.stdout[-1000:]} {result.stderr[-2000:]}')

    run('pm.mjs', 'check', '--project', demo / 'project.json')
    previous = demo / 'project.json'
    for week in (1, 2):
        update = demo / f'update-0{week}.json'
        review = build / f'review-0{week}'
        run('pm.mjs', 'review', '--project', previous, '--update', update, '--out', review)
        save(demo / f'review-0{week}.json', load(review / 'review.json'))
        next_state = demo / ('week-01.project.json' if week == 1 else 'final.project.json')
        selected = ','.join(c['id'] for c in load(update)['changes'])
        run('pm.mjs', 'accept', '--project', previous, '--update', update, '--select', selected, '--out', next_state)
        previous = next_state

    # Machine facts must be unchanged by translation; hashes naturally differ.
    actual = load(previous)
    expected = load(SOURCE / 'assets/demo/final.project.json')
    for field in ('id', 'statusDate'):
        assert actual[field] == expected[field], field
    for field in ('roles', 'groups', 'tasks', 'actions', 'decisions'):
        def facts(items):
            return [{k: v for k, v in item.items() if k not in ('name', 'title', 'acceptance')} for item in items]
        assert facts(actual[field]) == facts(expected[field]), field
    render = build / 'rendered'
    run('render.mjs', '--project', build / 'review-02/candidate.json', '--review', build / 'review-02/review.json', '--out', render, '--browser', args.browser)
    run('render.mjs', '--verify', '--out', render)
    shutil.copytree(render, demo, dirs_exist_ok=True)
    save(demo / 'verification.json', {'language': 'ja', 'canonicalLanguage': 'zh-CN', 'taskCount': 18, 'roleCount': 8, 'updatesReplayed': 2, 'machineFactsMatch': True, 'evidenceHashesRecomputed': True, 'status': 'passed'})
    examples = ROOT / 'examples/pm-update-ja'
    examples.mkdir(parents=True, exist_ok=True)
    for name in ('project.json', 'update-01.json', 'update-02.json', 'project-brief.md', 'week-01.md', 'week-02.md'):
        shutil.copyfile(demo / name, examples / name)
    public_images = ROOT / 'docs/assets/pm-update-ja'
    public_images.mkdir(parents=True, exist_ok=True)
    for extension in ('svg', 'png'):
        shutil.copyfile(render / f'schedule-03.{extension}', public_images / f'schedule.{extension}')
    source_hashes = inputs()
    save(target / 'edition.json', {'language': 'ja', 'canonicalLanguage': 'zh-CN', 'edition': '2026-10-23', 'stage': 'preview', 'sourceSHA256': source_hashes})
    guide = '''Taskobo Diagrams｜日本語版

まず taskobo-diagrams/assets/demo/review.html を開き、2回の週次会議を経た更新例を見る。
閲覧にはNodeやAIサービスは不要だ。18作業パッケージ・8役割の独立した架空教材を含む。

導入：taskobo-diagramsフォルダー全体を利用中のAIソフトが対応するSkillディレクトリへ置く。
Codexの例：~/.agents/skills/taskobo-diagrams/SKILL.md
AIセッションを再読込みする。対応する導入先と権限はAIソフトに従う。

実行環境：ローカルファイル・コマンドを扱えるAIソフト、Node 22.12+、導入済みChrome／Edge。
node scripts/render.mjs --doctor で環境を確認できる。
ブラウザーが自動検出されない場合は --browser で絶対パスを指定する。
モデル、キー、OCR、外部システム接続は含まず、ソフトの自動ダウンロードも行わない。

依頼例：$taskobo-diagrams で現在のproject.jsonと今週の議事録から、変更前後、根拠、
アクション、要判断事項、更新図表を整理する。承認済み基準を保ち、予測を確約と扱わない。
実案件の資料と結果は自分の作業ディレクトリに置き、導入先へ保存しない。

保守上の基準は中国語版だが、この公開パッケージの指示、教材、画面、図表は日本語版だ。
初期公開版。教材の更新案は手動レビュー済みのテスト入力で、実際のモデル呼出し記録ではない。
日本語ガイド：https://github.com/dfzzq719/taskobo-diagrams/blob/main/docs/pm-skill.ja.md
ライセンスと第三者通知はassets/runtime/を参照する。更新時は全体を再導入し、実案件を保持する。
'''
    files = {'はじめに.txt': guide.encode('utf-8-sig')}
    for file in sorted(target.rglob('*')):
        if file.is_file():
            files['taskobo-diagrams/' + file.relative_to(target).as_posix()] = file.read_bytes()
    with zipfile.ZipFile(DOWNLOAD, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    DOWNLOAD.with_suffix('.zip.sha256').write_text(f'{digest(DOWNLOAD.read_bytes())}  {DOWNLOAD.name}\n', encoding='ascii')
    save(DOWNLOAD.with_suffix('.manifest.json'), {'language': 'ja', 'sourceSHA256': source_hashes, 'fileSHA256': {n: digest(b) for n, b in sorted(files.items())}})
    print(json.dumps({'passed': True, 'language': 'ja', 'files': len(files), 'bytes': DOWNLOAD.stat().st_size, 'build': str(build)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
