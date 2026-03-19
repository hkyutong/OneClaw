---
summary: "Run OneClaw as an always-on assistant on a Linux VPS or home server and access it from chat apps anywhere."
read_when:
  - You want OneClaw available 24/7
  - You are deciding between laptop hosting and a VPS
title: "Always-On VPS Assistant"
---

# OneClaw as an always-on VPS assistant

If reliability is the goal, the recommended default is simple:

> run the gateway on a Linux VPS or home server, then talk to it from chat apps and the web UI.

## Why this is a strong default

- the assistant stays available when your laptop is closed
- chat channels are easier to keep online
- network behavior is more stable than a sleeping desktop
- the runtime host and your personal machine stay cleanly separated

## Best fit

- you want OneClaw reachable from your phone and laptop
- you want a 24/7 personal assistant
- you are comfortable with Docker or basic Linux hosting
- you plan to use chat apps as the main front door

## Recommended stack

- Linux VPS or home server
- Docker-based OneClaw deployment
- private access through SSH tunnel or Tailscale
- one main assistant before adding more agents or channels

## Good operating pattern

- host the gateway on the VPS
- use the browser UI for admin and inspection
- use Telegram, WhatsApp, Discord, or other chat apps for daily tasks
- pair nodes later if you need local-device capabilities

## When this is not the first choice

- you mainly want visible local browser automation on the same machine
- you are only experimenting for a short local session
- you do not want to manage a small server or Docker runtime

## Related pages

- [VPS hosting](/vps)
- [Docker install](/install/docker)
- [Gateway remote](/gateway/remote)
- [Hetzner](/install/hetzner)
- [Personal assistant](/use-cases/personal-assistant)
- [Telegram personal assistant](/use-cases/telegram-personal-assistant)
