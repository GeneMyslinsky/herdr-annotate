![Herdr Annotate](assets/herdr-annotate.webp)

# herdr-annotate
Annotate inside [Herdr](https://github.com/herdrdev/herdr): comment on any terminal text, review whole Markdown documents and your agent's replies, and send the feedback straight back to the agent. Document review is powered by [plannotator-tui](https://github.com/plannotator/plannotator-tui), which also runs on its own outside Herdr.

<p align="center">
  <a href="https://github.com/backnotprop/plannotator">
    <img src="./assets/star-plannotator.svg" width="280" alt="Like this? Star Plannotator">
  </a>
</p>

## Requirements

- Herdr 0.8.0 or later
- [Bun](https://bun.sh/)
- macOS, Linux, or Windows

On Linux, install `wl-clipboard`, `xclip`, or `xsel` for clipboard access.

On Windows, native Herdr plugin support is preview/best-effort. Bun must be on `PATH`. Clipboard access uses PowerShell; no extra clipboard package is required. The install, keybinding, configuration check, reload, and use instructions below also apply on Windows.

## Install

Two flavors, same plugin id — installing one over the other just swaps:

```sh
# Full: terminal-selection annotations + whole-document review (plannotator-tui)
herdr plugin install plannotator/herdr-annotate

# Lite: terminal-selection annotations only; no binary download, nothing Rust
herdr plugin install plannotator/herdr-annotate/lite
```

The full install fetches a checksummed `plannotator-tui` release into `bin/` during the
plugin build (macOS and Linux today). If that download fails you still get lite behavior,
and the review actions tell you to reinstall. Reinstalling is also how you upgrade.

Then add the keys to Herdr's config — the only manual step:

- macOS and Linux: `~/.config/herdr/config.toml`
- Windows: `%APPDATA%\herdr\config.toml`

```toml
[[keys.command]]
key = "prefix+a"
type = "plugin_action"
command = "annotate.capture"
description = "annotate text"

[[keys.command]]
key = "prefix+shift+a"
type = "plugin_action"
command = "annotate.copy-context"
description = "copy annotations as context"

[[keys.command]]
key = "prefix+m"
type = "plugin_action"
command = "annotate.manage"
description = "manage annotations"

# Full install only
[[keys.command]]
key = "prefix+o"
type = "plugin_action"
command = "annotate.open"
description = "review documents"

[[keys.command]]
key = "prefix+shift+o"
type = "plugin_action"
command = "annotate.last"
description = "review the agent's last message"
```

Check and reload:

```sh
herdr config check
herdr server reload-config
```

## Use

1. Select terminal text in Herdr.
2. Press `Ctrl+B A`.
3. Enter a comment.
4. Press `Ctrl+S` to save the annotation.

Press `Ctrl+B M` to manage annotations. Press `Ctrl+B Shift+A` to copy all annotations as Markdown.

The manager shows the newest annotations first. Press `y` to copy one annotation or `c` to copy all annotations. A successful copy closes the manager and keeps the annotations saved.

Press `Shift+C` to copy all active annotations, archive the set, and clear the active list. Press `Tab` to browse archives. In the archive view, press `y` to copy a set, `u` to restore it, or `d` twice to permanently delete it.

## Selection limits

Herdr Annotate reads text that Herdr copies to the system clipboard. The plugin cannot read selection state from Neovim or another terminal application.

## Review documents and agent replies

Full install only. Select text, comment, mark it 👍 looks good or ✗ delete; the header
button says where feedback goes (`Send 3 to claude in w1:p2 ▸`) and one click makes the
review the agent's next message. macOS and Linux today.

- `annotate.open` — the focused pane's folder, with a file tree.
- `annotate.last` — a picker of the agent's recent replies (Claude Code, Codex, pi, Copilot
  CLI, Droid); the review goes back to that agent.
- **Ctrl-click** a `file://…md` link an agent printed.
- **The agent asks for review.** Install the skill once; agents then run
  `plannotator-tui herdr open <file>` and end their turn, and the review arrives as their
  next message:

  ```sh
  npx skills add plannotator/herdr-annotate --skill plannotator-tui -g
  ```

Where it opens is yours: `~/.config/plannotator-tui/config.toml` with
`[herdr] placement = "overlay"` (full tab, default), `"split"` (beside the agent) or `"popup"`.
Want plannotator-tui without Herdr? See its [README](https://github.com/plannotator/plannotator-tui).

## Development

```sh
bun install
bun test
bun run typecheck
herdr plugin link "$PWD"
```

To test a local plannotator-tui build instead of the pinned release, put it in `bin/`
before linking: `PLANNOTATOR_TUI_BIN=/path/to/plannotator-tui bash scripts/fetch-plannotator-tui.sh`.
`herdr plugin link` replaces any existing `annotate` link; link the other directory to switch back.

## Neovim integration

Add this visual-mode mapping to `~/.config/nvim/lua/config/keymaps.lua` for LazyVim, or to `init.lua`:

```lua
vim.keymap.set("x", "<leader>a", function()
  vim.cmd('normal! "+y')
  vim.fn.jobstart({
    "herdr",
    "plugin",
    "action",
    "invoke",
    "annotate.capture",
  })
end, { desc = "Annotate in Herdr" })
```

Select text with the mouse or Visual mode. Then press `<leader>a` to open Herdr Annotate.

LazyVim uses `Space` as `<leader>` by default. The mapping keeps mouse support and leaves normal Neovim commands unchanged.
