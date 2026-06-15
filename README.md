# Starttech marketplace

The Starttech [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces).
Bundles product, analytics, and engineering skills you can install with one command
instead of copying files into `~/.claude/skills` by hand.

## Plugins

| Plugin | What it adds |
| --- | --- |
| `product-management` | Product management & analytics skills for Starttech teams. |

## Install

From any project, in Claude Code — add the marketplace once, then install any plugin
from the [Plugins](#plugins) list above by name:

```
/plugin marketplace add Starttech-Labs/starttech-plugin-marketplace
/plugin install <plugin>@starttech
```

After install, that plugin's skills are namespaced as `<plugin>:<skill-name>` and
trigger automatically when their subject comes up in conversation.

## Maintainership

Public so anyone can install and inspect the skills. Maintained by Starttech Labs —
not open to external contributions.
