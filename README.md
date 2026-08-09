# herdr-annotate

![Herdr Annotate](assets/herdr-annotate.webp)

Herdr Annotate adds comments to copied terminal text in [Herdr](https://github.com/herdrdev/herdr). It collects annotations as Markdown for use with any agent.

## Requirements

- Herdr 0.8.0 or later
- [Bun](https://bun.sh/)
- macOS or Linux

On Linux, install `wl-clipboard`, `xclip`, or `xsel` for clipboard access.

## Install

```sh
herdr plugin install plannotator/herdr-annotate
```

Add these key bindings to `~/.config/herdr/config.toml`:

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

The manager shows the newest annotations first. It can copy or delete one annotation, copy all annotations, or clear the list.

## Selection limits

Herdr Annotate reads text that Herdr copies to the system clipboard. The plugin cannot read selection state from Neovim or another terminal application.

## Development

```sh
bun install
bun test
bun run typecheck
herdr plugin link "$PWD" --enabled
```
