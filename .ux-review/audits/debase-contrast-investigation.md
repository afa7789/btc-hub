# `/debase` axis titles — axe says 1.06:1. Twice wrong before the right answer.

**The claim:** axe-core reports every `/debase` chart's rotated y-axis title as
`#000000` on `#0a0a0a` = **1.06:1** in the light theme — invisible text on the
deliberately dark chart canvas. Ten nodes on `/debase`, one each on `/halving`
and `/rainbow`.

## First conclusion (wrong)

The original version of this file said the titles were black *briefly* and then
became white, and blamed render timing: a probe at 1500 ms read white, while axe
running at 400–700 ms read black. Filed as P3, "a transient flash while eleven
D3 charts are built".

That explanation was invented to fit two measurements taken at different times.
It was never tested.

## What is actually true

Probing the same elements at three delays:

```
1500ms: { labels: 10, fills: ['rgb(255, 255, 255)'] }
3000ms: { labels: 10, fills: ['rgb(255, 255, 255)'] }
6000ms: { labels: 10, fills: ['rgb(255, 255, 255)'] }
```

White at every delay, including one earlier than the axe run that reported
black. So there is no flash and there never was.

The real cause: these are SVG `<text>` nodes, and axe reads the inherited CSS
`color` property — which in the light theme is `#000` — instead of the `fill`
that actually paints the glyph. `--chart-ink` is deliberately absent from the
`[data-theme="light"]` block because the chart canvas stays dark in both themes
(DESIGN.md §2.2), so the rendered contrast is white on `#0a0a0a` = **19.80:1**.

The agent that migrated `chart_draw.js`'s colour literals reached the same
conclusion independently while measuring its own change.

## Consequence

Not a defect at any severity. Recorded in `.claude/FALSE_POSITIVES.md` so later
review rounds drop it instead of re-filing it.

**The lesson is the process failure, not the finding.** A tool reported a number,
the number did not match a spot check, and rather than measuring the property
the browser actually uses, the first pass built a story that reconciled the two
observations. One extra probe would have settled it.
