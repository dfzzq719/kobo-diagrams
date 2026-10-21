#!/usr/bin/env python3
"""Package the standalone Chinese PM Skill and its offline teaching example."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/taskobo-diagrams"
OUTPUT = ROOT / "docs/downloads/taskobo-diagrams-zh-CN.zip"
# Keep previously shared download links working; both names contain the new Skill.
LEGACY_OUTPUT = ROOT / "docs/downloads/kobo-pm-update-zh-CN.zip"
GUIDE = """Taskobo Diagrams Skill｜中文 Alpha

让 AI 承担繁杂的文档整理，让项目经理专注判断、沟通与交付。

先看结果：解压后双击 taskobo-diagrams/assets/demo/review.html。
这是独立虚构教学案例的第二次周会审阅预览，含修改对照、行动项、待决事项和三类图表。
查看示例不需要 Node 或 AI 服务；执行项目更新与出图则需要下述环境。

安装：将完整 taskobo-diagrams 文件夹放入 AI 软件支持的 Skill 目录。
Codex 的用户目录示例为 ~/.agents/skills/taskobo-diagrams/，其中直接包含 SKILL.md。
不同软件的识别位置与权限方式不同，请遵循所用软件的说明。

运行条件：支持本地文件与命令执行的 AI 软件、Node 22.12+、已安装的 Chrome 或 Edge。
本包不带模型或密钥，不下载软件，不自动连接外部系统，也不会启动常驻的多个 Agent。
AI 理解材料，随包脚本负责结构与证据核对、更新记录和图表渲染。

在安装文件夹中检查环境：
node scripts/render.mjs --doctor

给自己的 AI 这样说：
使用 $taskobo-diagrams，根据这个项目的现有状态和本周纪要，先生成修改前后对照、行动项、
需要拍板的问题和更新图表。保留批准基准，说明每次修改的材料依据。

自己的业务材料与结果保存在自己的项目目录，不要写入安装目录。
assets/demo/ 含初始项目、两次纪要、示例修改包、已保存示例状态和重放校验记录。
示例修改包由维护者编写用于复现，不是现场调用模型的记录。

项目说明：https://github.com/dfzzq719/kobo-diagrams/blob/main/docs/pm-skill.zh-CN.md
许可及第三方声明见随包 runtime 文件。更新 Skill 时重新下载完整包，并保留自己的项目文件。
"""


def build():
    for required in ("SKILL.md", "scripts/pm.mjs", "scripts/project.mjs", "scripts/render.mjs", "assets/demo/review.html"):
        if not (SKILL / required).is_file():
            raise SystemExit(f"Missing Skill artifact: {required}")
    files = {"开始使用.txt": GUIDE.encode("utf-8-sig")}
    for file in sorted(SKILL.rglob("*")):
        if file.is_file():
            if file.is_symlink() or "__pycache__" in file.parts:
                raise SystemExit(f"Unexpected linked/cache file: {file}")
            data = file.read_bytes()
            try:
                data = data.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
            except UnicodeDecodeError:
                pass
            files[f"taskobo-diagrams/{file.relative_to(SKILL).as_posix()}"] = data
    if sys.argv[1:] == ["--check"]:
        with zipfile.ZipFile(OUTPUT) as archive:
            if sorted(archive.namelist()) != sorted(files):
                raise SystemExit("Skill archive file list differs; rebuild the ZIP")
            for name, data in files.items():
                if archive.read(name) != data:
                    raise SystemExit(f"Skill archive differs: {name}; rebuild the ZIP")
        digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
        if OUTPUT.with_suffix(".zip.sha256").read_text(encoding="ascii") != f"{digest}  {OUTPUT.name}\n":
            raise SystemExit("Skill archive checksum differs")
        if LEGACY_OUTPUT.read_bytes() != OUTPUT.read_bytes():
            raise SystemExit("Legacy download alias differs")
        if LEGACY_OUTPUT.with_suffix(".zip.sha256").read_text(encoding="ascii") != f"{digest}  {LEGACY_OUTPUT.name}\n":
            raise SystemExit("Legacy download checksum differs")
        print(json.dumps({"verified": True, "files": len(files), "sha256": digest}))
        return
    if sys.argv[1:]:
        raise SystemExit("Usage: python scripts/build-pm-skill.py [--check]")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix(".zip.sha256").write_text(f"{digest}  {OUTPUT.name}\n", encoding="ascii")
    LEGACY_OUTPUT.write_bytes(OUTPUT.read_bytes())
    LEGACY_OUTPUT.with_suffix(".zip.sha256").write_text(f"{digest}  {LEGACY_OUTPUT.name}\n", encoding="ascii")
    print(json.dumps({"files": len(files), "bytes": OUTPUT.stat().st_size, "sha256": digest}))


if __name__ == "__main__":
    build()
