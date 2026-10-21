/** Frozen profiles accept content and structure; source-level styling is rejected. */
export function validateFrozenSource(input) {
  const source = String(input).replace(/^\uFEFF/, '');
  if (!source.trim()) throw new Error('ソースが空です。');
  const violations = [];
  if (/^\s*---(?:\r?\n|$)/.test(source)) violations.push('YAML frontmatter（設定ブロックを除き、図が対応する title 記法をお使いください）');
  if (/%%\s*\{/.test(source)) violations.push('Mermaid init/config 指示');
  // Regular comments are ignored so a sentence explaining a forbidden keyword is harmless.
  const statements = source.split(/\r?\n/).filter(line => !/^\s*%%/.test(line)).join('\n')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gs, '"content"');
  if (/(?:^|[;\r\n])\s*(?:classDef|linkStyle|style|cssClass)\b/im.test(statements)) violations.push('classDef / linkStyle / style / cssClass スタイル指定');
  if (/\b(?:UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig|AddElementTag|AddRelTag)\s*\(/i.test(statements)) violations.push('C4 の独自スタイル・設定指定');
  if (violations.length) throw new Error('固定スタイルを上書きする指定が含まれています：' + [...new Set(violations)].join('；') + '。内容と構造を残し、該当の指定を除いてください。元のファイルは書き換えていません。');
  return source;
}
