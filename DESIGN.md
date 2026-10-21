# Kobo Diagrams repository presentation

The repository is a reading surface with an artifact-led opening. The product is
the exact diagram output: every displayed node, bar and responsibility cell is
rendered by the package, from fictional, committed source inputs. The assets are
proof sheets, not screenshots of an invented application.

Inherit Taskobo's paper, navy and cobalt identity. Use `#FFFEFA` for the page,
`#0D2046` for structural ink, `#1456D9` for emphasis and `#52637A` for supporting
copy. Give each figure open space and a concise caption. Separate major regions
with a hairline instead of rounded cards, decorative backgrounds or gradients.
Typography follows the established Noto Sans JP / Yu Gothic / Meiryo sans stack;
code and exact version data retain monospace. No decorative icon family is needed.

The opening must prove business depth. Use the complete six-document CRM case in
`examples/project-case/`: its scope hierarchy, decision loops, integrated variance
schedule, full responsibility matrix, risks and issues share the same scenario.
Never replace those sources with a four-node hierarchy, a few-task schedule or a
three-row responsibility table for visual convenience. The source manifest owns
the facts and counts; the generator reads it without simplifying business content.

The header's product name is modest. Actual schedule variance, the complete RACI
structure and readable work-package/ownership details carry the composition.
Distinguish full overview from detail at the image itself. Each document ships a
complete original SVG and complete PNG, visible in the gallery without a collapsed
disclosure. Detail images change only the original SVG's root viewBox; record that
viewport and retain all underlying source content. Offer complete figures beside
the details, not hidden behind them. A dense overview may establish structure;
never pretend that ant-sized overview labels are readable detail. On narrow screens
preserve reading scale with scrollable details and an explicit complete-SVG link.

For late-row table details, keep every role or judgment column. Group whole
columns into reading-width panels and pair the original header viewport with the
same original body-row viewport in each panel. Label source row/column ranges;
do not reconstruct a smaller table or omit Operations, triggers, response or
closure evidence to make the graphic fit. Record each header/body viewBox in the
asset manifest so the relation to the complete SVG is independently inspectable.

New business assets use `docs/assets/crm-case/` so image caches cannot retain the
superseded tiny examples. The previous architecture figure is a technical
integration explanation, not evidence of business-document capability. The RACI
palette comes from the installed renderer: navy accountable, soft blue responsible,
quiet gray consulted/informed and blue-gray combined roles. Do not recolor actual
output or change runtime tokens to decorate the repository.

English is the public README entry; a complete Chinese README mirrors its content.
Use relative image links for GitHub. State release and npm availability precisely.
No adoption metrics, certification badges, claims of pixel-identical browsers,
fabricated screenshots or automatic deployment promises. Keep marketing images
outside the npm tarball. Source SVGs, inputs and the browser generator remain
reviewable in GitHub.
