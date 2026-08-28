![Herdr Annotate](assets/herdr-annotate.webp)

# herdr-annotate
Herdr Annotate adds comments to copied terminal text in [Herdr](https://github.com/herdrdev/herdr). It collects annotations as Markdown for use with any agent, and opens whole Markdown documents for review with [plannotator-tui](https://github.com/plannotator/plannotator-tui).

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

```sh
herdr plugin install plannotator/herdr-annotate
```

Add these key bindings to Herdr's config:

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
```

Make sure that the configuration is valid:

```sh
herdr config check
```

Reload the configuration:

```sh
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

## Review documents with plannotator-tui

The full plugin also opens whole Markdown documents for review with
[plannotator-tui](https://github.com/plannotator/plannotator-tui): select text, comment,
mark it 👍 looks good or ✗ delete, and send the review straight back to the agent as its
next message. The header button always says where feedback goes, for example
`Send 3 to claude in w1:p2 ▸`. macOS and Linux for now; the build step downloads a
checksummed release binary into `bin/`.

Four ways in:

- **A key.** Bind `annotate.open`; it opens the focused pane's folder with a file tree.

  ```toml
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

- **The agent's last message.** Bind `annotate.last`; in an agent's pane it opens a picker
  of that agent's recent messages, and the review goes back to the same agent. Nothing is
  written to disk for a message review.

- **Ctrl-click** a `file://…md` link an agent printed. Web links are never touched.
- **The agent itself**, when it has written a plan it wants reviewed. Install the skill
  once and agents run `plannotator-tui herdr open <file>` from their own pane; the review
  arrives as their next message:

  ```sh
  npx skills add plannotator/herdr-annotate --skill plannotator-tui -g
  ```

Where plannotator-tui opens is your choice:

```toml
# ~/.config/plannotator-tui/config.toml
[herdr]
placement = "overlay"   # overlay (full tab, default) | split (beside the agent) | popup
```

`plannotator-tui config` prints the file's path and the values in effect.

### Lite install

For the terminal-selection tools only, with no binary download (all platforms):

```sh
herdr plugin install plannotator/herdr-annotate/lite
```

### Test locally before a release

Build plannotator-tui from source, put that build into `bin/` instead of downloading,
and link this checkout:

```sh
(cd ~/oss/plannotator-tui && cargo build --release)
PLANNOTATOR_TUI_BIN=~/oss/plannotator-tui/target/release/plannotator-tui bash scripts/fetch-plannotator-tui.sh
herdr plugin link "$PWD"
```

`herdr plugin link` replaces any existing `annotate` link (one plugin id, one directory).
To go back to another checkout, link that directory again, for example
`herdr plugin link ~/oss/herdr/herdr-annotate`. Then bind `annotate.open` as above and
`herdr server reload-config`.

## Development

```sh
bun install
bun test
bun run typecheck
herdr plugin link "$PWD" --enabled
```

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
