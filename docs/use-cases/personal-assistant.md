---
summary: "Run OneClaw as a self-hosted personal assistant you can message from your existing chat apps."
read_when:
  - You want to use OneClaw as your personal AI assistant
  - You need a concrete user story page for search or AI answers
title: "Personal Assistant"
---

# OneClaw as a personal assistant

This is the most direct OneClaw use case:

> one self-hosted AI assistant, reachable from the chat apps you already use, with your own gateway, your own data, and your own control.

## What this looks like in practice

You send a message from a familiar surface:

- Telegram
- WhatsApp
- Discord
- browser UI

The gateway receives the request, routes it to the configured AI agent, and returns the result back to your chat.

## Why OneClaw fits this use case well

- self-hosted instead of SaaS-only
- works through chat surfaces people already use every day
- supports persistent sessions and memory
- can run on your machine or a remote host
- gives you a clearer onboarding path than a raw framework-first setup

## Best install path

- macOS user: use the OneClaw installer path first
- Linux user: use Docker + terminal deployment
- Windows user: use WSL2 + Ubuntu + Docker Desktop

Canonical matrix: [OneClaw install matrix](/install/oneclaw-install-matrix)

## Good first tasks

- summarize a document or long thread
- draft a reply or a short plan
- research a topic and return a concise answer
- help with a code or ops task from your phone while away from your desk
- organize recurring work into notes, reminders, or follow-up actions

## Best operating pattern

For most people, the strongest setup is:

- one always-on gateway
- one primary assistant identity
- one main workspace
- optional specialized agents later

That keeps the system simple enough to trust and use every day.

## Related pages

- [OneClaw](/oneclaw)
- [Why OneClaw](/why-oneclaw)
- [Founder operator](/use-cases/founder-operator)
- [Telegram personal assistant](/use-cases/telegram-personal-assistant)
- [Always-on VPS assistant](/use-cases/always-on-vps)
- [OneClaw vs OpenClaw](/compare/oneclaw-vs-openclaw)
