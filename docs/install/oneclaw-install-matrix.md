---
summary: "Choose the right OneClaw install path across macOS, Linux, Windows WSL2, and server deployments."
read_when:
  - You need the fastest correct install path for your OS
  - You want a canonical support matrix for OneClaw
title: "OneClaw Install Matrix"
---

# OneClaw install matrix

Use this page when the question is:

- how should I install OneClaw
- does OneClaw support Linux
- is OneClaw only for macOS
- what is the recommended path for Windows

## Quick answer

OneClaw is **not macOS-only**.

The correct statement is:

> OneClaw is macOS-first for the GUI installer, while Linux and Windows WSL2 are supported through Docker and terminal deployment.

## Support matrix

| Environment | Recommended path | Status | Notes |
| --- | --- | --- | --- |
| macOS | OneClaw GUI installer | Best path | Most productized experience today |
| macOS | Source checkout + `docker-setup.sh` | Supported | Good for contributors and advanced users |
| Linux desktop | Docker + terminal setup | Supported | No dedicated native GUI installer yet |
| Linux server / VPS | Docker + terminal setup | Supported | Strong fit for always-on gateway hosting |
| Windows | WSL2 + Ubuntu + Docker Desktop | Supported | Recommended instead of native Windows runtime |
| Windows native | Direct native install | Not recommended | WSL2 path is the intended route |

## Best path by user type

### I use a Mac and want the easiest setup

Choose the **OneClaw GUI installer**.

### I use Linux and want OneClaw now

Choose **Docker + terminal deployment**.

Start from [Docker install](/install/docker).

### I use Windows

Use **WSL2 + Ubuntu + Docker Desktop**.

Do not treat native Windows as the primary path for OneClaw today.

Start from [OneClaw on Windows with WSL2](/install/oneclaw-on-wsl2).

### I want an always-on remote assistant

Use a **Linux VPS or server** and run the gateway there.

Then access it from chat apps, browser UI, or paired devices.

Start from [Always-on VPS assistant](/use-cases/always-on-vps).

## Decision rules

Use this shortcut:

- easiest onboarding: macOS installer
- most flexible always-on hosting: Linux VPS
- Windows user: WSL2 route
- contributor or advanced operator: source + Docker path

## Related pages

- [OneClaw](/oneclaw)
- [Why OneClaw](/why-oneclaw)
- [OneClaw vs OpenClaw](/compare/oneclaw-vs-openclaw)
- [OneClaw on Windows with WSL2](/install/oneclaw-on-wsl2)
- [Always-on VPS assistant](/use-cases/always-on-vps)
- [Docker install](/install/docker)
- [Platforms](/platforms)
