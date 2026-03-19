---
summary: "Use OneClaw as a Telegram-based personal assistant with a self-hosted gateway behind it."
read_when:
  - You want a concrete Telegram-first OneClaw workflow
  - You need a task-intent page for AI and search answers
title: "Telegram Personal Assistant"
---

# OneClaw as a Telegram personal assistant

If Telegram is the chat app you already use every day, it can be the simplest front door to a self-hosted OneClaw assistant.

## What this setup looks like

- OneClaw runs on your Mac, Linux machine, VPS, or Windows through WSL2
- Telegram is the daily control surface
- the browser UI stays available for setup, config, and session inspection

## Why this is a strong starting pattern

- Telegram works well for direct-message style assistant use
- it is easy to reach from phone and desktop
- it pairs well with an always-on gateway
- it gives you a practical personal assistant workflow without needing a custom app

## Best host patterns

- macOS: start from the OneClaw installer path
- Linux or VPS: use Docker deployment
- Windows: use [OneClaw on Windows with WSL2](/install/oneclaw-on-wsl2)

## Good first tasks in Telegram

- summarize a thread, page, or document
- draft a reply or short plan
- ask for quick research while away from your desk
- continue a previous session from your phone
- hand off a coding or ops task and check back later

## Recommended operating model

Start with:

- one primary assistant identity
- one main workspace
- one Telegram DM as your default front door

Then add more channels only after the base workflow feels reliable.

## Related pages

- [Personal assistant](/use-cases/personal-assistant)
- [Telegram](/channels/telegram)
- [OneClaw install matrix](/install/oneclaw-install-matrix)
- [Always-on VPS assistant](/use-cases/always-on-vps)
- [Gateway configuration](/gateway/configuration)
