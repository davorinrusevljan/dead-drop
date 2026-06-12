---
title: "Introducing dead-drop"
date: "2026-06-08"
description: "Privacy-focused, ephemeral data sharing with zero-knowledge encryption. No account needed. Open source."
author: "ghostgrammer"
---

# Introducing dead-drop

There are plenty of ways to share text online. Pastebins, encrypted messengers, self-destructing note services. So why build another one?

Because none of them solved the problem the way we wanted.

## The problem

Most secret-sharing tools give you a long, random URL and a separate password. To share it, you need two channels — one for the link, one for the password. You can't just tell someone in person: "go to this site and type this."

That friction matters. If sharing is hard, people fall back to plain text messages, emails, and DMs. The security evaporates.

## Our approach

dead-drop gives every drop a **human-readable name** — four common words, like `abacus-abide-ablaze-able`. The name stays in the URL fragment (`dead-drop.xyz/#name`) and is **never sent to the server**. Only its SHA-256 hash reaches the backend.

This means you can share a drop verbally: "Go to dead-drop.xyz and type abacus-abide-ablaze-able." One channel. Speakable. Memorable.

## Zero-knowledge encryption

Private drops use **AES-256-GCM** encryption with keys derived via **PBKDF2** (100,000 iterations). All encryption happens in your browser using the Web Crypto API. The server never sees your password. The server never sees your plaintext. We literally cannot read your data, even if compelled to.

Public drops store content as plaintext — anyone with the name can read it — but you can still protect edits with a password.

## Ephemeral by default

Every drop self-destructs after **7 days**. No manual cleanup. No forgotten secrets sitting in a database forever. Deleted means deleted (from the active database — residual copies may persist in backups, as our [Terms of Service](/terms) explain).

## What's next

We're working on:

- **Deep drops** — extended TTL for content that needs to last longer
- **Whistle drops** — anonymous tips to any drop
- **JavaScript SDK & CLI** — developer tools for programmatic access
- **Blog** — you're reading it

## Try it

Head to [dead-drop.xyz](/) and create your first drop. No account needed. No tracking. No catch.

The source code is available on [GitHub](https://github.com/davorinrusevljan/dead-drop) under the MIT license.
