---
summary: "Install OneClaw on Windows through WSL2, Ubuntu, and Docker Desktop."
read_when:
  - You want the recommended Windows path for OneClaw
  - You need a OneClaw-specific install page for WSL2
title: "OneClaw on Windows with WSL2"
---

# OneClaw on Windows with WSL2

If you want to run OneClaw on Windows, the recommended path is:

> **WSL2 + Ubuntu + Docker Desktop**

This is the practical route for OneClaw today.
It keeps the runtime close to the Linux and server paths instead of forcing a native Windows-first install.

## Why this is the recommended path

- closer to the Linux runtime used across the rest of the docs
- more predictable Docker-based deployment
- better fit for an always-on assistant on a Windows machine
- easier to map to existing OpenClaw platform guidance

## What you need

- Windows with WSL2 support enabled
- Ubuntu installed inside WSL2
- Docker Desktop with WSL integration enabled
- model provider credentials
- one first messaging surface, such as Telegram or Discord

## Recommended flow

1. Install **WSL2** and **Ubuntu**.
2. Install **Docker Desktop** and enable WSL integration for Ubuntu.
3. Start with [Docker install](/install/docker).
4. Use [Windows (WSL2)](/platforms/windows) for Windows-specific notes and troubleshooting.
5. Use [OneClaw install matrix](/install/oneclaw-install-matrix) if you are comparing this path against macOS or Linux.

## When this path is a strong fit

- Windows is your main desktop OS
- you want OneClaw without moving to a separate Mac
- you are comfortable with a terminal-based install
- you want to keep the gateway running while still working from Windows apps

## What this path is not

- not the macOS GUI installer path
- not a native Windows desktop installer
- not the best choice if you do not want WSL2 or Docker

## Good first use case

For many Windows users, the first strong setup is:

- run the gateway inside WSL2
- talk to it from Telegram or Discord
- use the browser UI for local control and session checks

## Related pages

- [OneClaw](/oneclaw)
- [OneClaw install matrix](/install/oneclaw-install-matrix)
- [Windows (WSL2)](/platforms/windows)
- [Docker install](/install/docker)
- [Telegram personal assistant](/use-cases/telegram-personal-assistant)
