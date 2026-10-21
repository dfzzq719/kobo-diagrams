#!/usr/bin/env python3
"""Build the Chinese PM starter from committed sources and rendered images."""
from html import escape
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "examples/project-case/zh-CN"
ASSETS = ROOT / "docs/assets/crm-case/zh-CN"
OUTPUT = ROOT / "docs/downloads/kobo-diagrams-zh-CN.zip"
PREFIX = "中文项目图表工作包/"
DOCUMENTS = [
    ("wbs", "wbs.mmd", "工作分解", "确认交付范围与验收条件。"),
    ("raci", "raci.json", "责任分配", "明确谁拍板、谁执行、谁需要参与。"),
    ("workflow", "change-control.mmd", "变更流程", "讨论变更的评估、授权与验收。"),
    ("gantt", "schedule.mmd", "项目日程", "对照基准、实际完成与预测日期。"),
]

GUIDE = """中文项目图表工作包

让 AI 承担繁杂的文档整理，让项目经理专注判断、沟通与交付。

1. 双击“画册.html”查看四类中文图表。图片可直接插入项目材料，矢量图适合放大查看。
2. 把项目背景、已有材料、对应的可编辑源文件和“给AI的任务说明.txt”交给你常用的 AI 工具。
3. 核对 AI 提出的假设与待确认问题，确认范围、角色、日期和验收条件。
4. 在配套样式工具中绘制修改后的源码。通过工具内的 DOCSKOBO 编辑入口继续确认、编辑和导出。

配套样式工具：https://taskobo.com/free-tools/mermaid/ （当前界面为日文）
中文文档工作区：https://docskobo.com/app?lang=zh
项目说明：https://github.com/dfzzq719/kobo-diagrams

四类材料来自同一个虚构的客户服务系统导入项目，状态日为2026年10月14日。
工作包包含图片、矢量图与可编辑源文件，不包含 AI 服务或 API 密钥。
双击画册即可看图；修改后的源码通过配套工具重新绘制。
"""

PROMPT = """请作为项目管理助理，根据我提供的项目事实和四份格式示例，协助整理项目材料。

先列出缺少的信息、需要确认的假设与可能的冲突。等我确认后，再输出四份可编辑源文件：

一、工作分解：把交付范围拆成具体成果物，为末级工作包列出验收条件。
二、责任分配：明确最终责任、执行、咨询与知情角色，每项工作有明确的最终责任和执行责任。
三、变更流程：保留评估、批准、延期、拒绝、验证与业务验收，条件未满足时保留待处理分支。
四、项目日程：区分基准、实际完成、预计完成和待批准的计划，检查日期与前后条件是否一致。

沿用所附示例的结构与字段格式，替换为我确认的项目事实；保留源码中的状态与日期标记规则。
资料不足的内容先列入待确认清单，确认后再填入图表。
输出四份源文件，并简要说明本次修改及依据，方便我组织团队评审。

项目背景：
【在这里补充项目目标、范围、参与角色、关键日期、当前问题和已经作出的决定。】
"""


def build():
    files = {
        "先读我.txt": GUIDE.encode("utf-8-sig"),
        "给AI的任务说明.txt": PROMPT.encode("utf-8-sig"),
        "许可原文.txt": (ROOT / "LICENSE").read_bytes(),
    }
    sections = []
    for identifier, filename, title, description in DOCUMENTS:
        suffix = Path(filename).suffix
        files[f"可编辑源文件/{title}{suffix}"] = (SOURCES / filename).read_bytes()
        files[f"图片/{title}.png"] = (ASSETS / f"{identifier}-figure.png").read_bytes()
        files[f"矢量图/{title}.svg"] = (ASSETS / f"{identifier}.svg").read_bytes()
        sections.append(
            f'<section><h2>{escape(title)}</h2><p>{escape(description)}</p>'
            f'<a href="矢量图/{title}.svg"><img src="图片/{title}.png" alt="中文{title}完整图"></a>'
            f'<p><a href="可编辑源文件/{title}{suffix}">可编辑源文件</a></p></section>'
        )
    gallery = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>中文项目图表工作包</title>
<style>:root{color-scheme:light;background:#fffefa;color:#0d2046;font:18px/1.7 "Microsoft YaHei","PingFang SC",sans-serif}*{box-sizing:border-box}body{max-width:1200px;margin:auto;padding:24px 24px 60px}h1{font-size:32px;line-height:1.3}h2{font-size:24px}section{margin-top:40px;padding-top:20px;border-top:1px solid #d7dce6}img{display:block;width:100%;height:auto}a{color:#1456d9;text-underline-offset:4px}a:focus-visible{outline:3px solid #c64c38;outline-offset:4px}::selection{background:#d8e5ff;color:#0d2046}</style>
<h1>把项目材料变成团队能用的图表</h1><p>让 AI 协助整理，让项目经理专注判断、沟通与交付。</p>
<p>虚构项目示例。点击图片查看矢量大图；使用方法见<a href="先读我.txt">先读我</a>。</p>
''' + "".join(sections) + "</html>\n"
    files["画册.html"] = gallery.encode("utf-8")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for filename, content in sorted(files.items()):
            entry = zipfile.ZipInfo(PREFIX + filename, date_time=(2026, 10, 21, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip() is not None or len(archive.namelist()) != 16:
            raise RuntimeError("The starter archive is incomplete or corrupt.")
    print(json.dumps({"path": str(OUTPUT), "files": len(files), "bytes": OUTPUT.stat().st_size,
                      "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}, ensure_ascii=False))


if __name__ == "__main__":
    build()
