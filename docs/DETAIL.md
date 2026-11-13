# Siwei

A read-only board for pipelines that write a piece in stages. Each run leaves a
`pipeline_state.json` next to its artifacts; this plugin reads those files and
shows the shape of the work without ever advancing it.

## What it shows

- A sidebar entry opens the board in the main area.
- One card per production line: whether its directory exists, how far the latest
  run got, and which of the five stages (A–E) are done.
- A reverse-chronological list of recent runs, including halted ones and why.
- A button that opens a new conversation with the starter prompt already in the
  composer — it is never sent for you.

## What it does not do

- It never advances a stage. Stage transitions belong to the pipeline's own
  scripts and checkpoints.
- It does not bundle skills; they load from the harness skill directories.
- It does not edit the ledger. There is no "mark done" button, so no way to skip
  a checkpoint from the UI.

## Layout it expects

```
<workspace>/
  思维工艺/每日DEMO/
    <YYYY-MM-DD>_<topic>/
      pipeline_state.json
      中间件/A_hotspots.json
      ...
```

`config.workspace` points at the workspace root; the daily runs live under
`思维工艺/每日DEMO/`. Change `lib/lines.js` if your pipeline uses another layout.
