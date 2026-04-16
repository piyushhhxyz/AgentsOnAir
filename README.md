# AgentOnAir

> A universal format for packaging and sharing AI agents — like AirDrop, but for agents.

---

## Quick Start

```bash
git clone https://github.com/piyushhhxyz/AgentsOnAir.git
cd AgentsOnAir
npm install

# Set up the CLI (pick one):
npm link                                    # if you have write access to global node_modules
# OR
alias brewagent="node $(pwd)/src/cli.js"    # works everywhere (Nix, restricted envs, etc.)

# Pack an agent
brewagent pack examples/startup-advisor
# -> startup-advisor-1.0.0.agent (1.7 KB)

# Share the .agent file (AirDrop, Slack, email — however you want)

# Install and run it
brewagent install startup-advisor-1.0.0.agent
export OPENAI_API_KEY="your-key"   # optional — works without it in demo mode
brewagent run startup-advisor -m "I'm building npm for AI agents"
```

### All Commands
| Command | What it does |
|---|---|
| `brewagent init [name]` | Scaffold a new agent (with templates: research, outreach, etc.) |
| `brewagent pack [dir]` | Bundle into a portable `.agent` file |
| `brewagent install <file>` | Install from `.agent` file or registry |
| `brewagent run <name>` | Run an installed agent |
| `brewagent publish [dir]` | Publish to local registry |
| `brewagent list` | Browse registry and installed agents |
| `brewagent inspect <file>` | Examine a `.agent` file |

---

## The Problem

There's a sharing primitive for everything in software.

| What you built | How you share it |
|---|---|
| A codebase | `.git` |
| An iOS app | `.ipa` |
| An Android app | `.apk` |
| A website | A Vercel link |
| **An AI agent** | ??? |

You've built a genuinely useful AI agent. You've put real thought into it — the way it behaves, what it knows, what it can do. Your friend sees it and wants it.

**How do you share it?**

Today, agents live inside platforms. If you built it in ChatGPT, it's a Custom GPT — your friend needs a ChatGPT account and you can only share it via the GPT Store, within OpenAI's walled garden. If you built it in Claude, it lives in a Claude Project, which is yours alone and doesn't leave your account. If you built it in n8n, Flowise, or any other workflow builder, your friend needs that exact same platform installed, the same version, the same integrations configured. If you built it yourself with code and an API, they'd need to clone your repo, configure their environment, get their own API keys, and hope nothing breaks.

Every current method of sharing an agent comes with one hard requirement: the other person must already be inside your platform, your environment, or your workflow. The agent doesn't travel. It's always tethered to where it was built.

---

## The Solution: `.agent`

AgentOnAir introduces the `.agent` file — a single, self-contained bundle that packages everything about an agent in one place.

Everything that makes your agent *your agent* — how it behaves, what it's capable of, what it knows by default — travels inside this one file.

Hand it to a friend over AirDrop. Share it as a download link. Post it publicly. The person receiving it doesn't need to be on any particular platform, doesn't need to reconstruct your setup from scratch, and doesn't need to be a developer. They open the file and the agent runs.

This is the same idea behind how other portable formats work. A `.ipa` file packages an iOS app so anyone with an iPhone can install it, regardless of how the developer originally built it. An `.apk` does the same for Android. AgentOnAir does the same thing for agents.

---

## Why This Doesn't Exist Yet

The agent ecosystem today is fragmented by design. Every major platform — OpenAI, Anthropic, Google, n8n, Flowise — has an incentive to keep agents inside their own walls. Sharing within a platform is easy. Sharing *across* platforms, or sharing an agent so it runs independently of any platform entirely, is something nobody has built a standard for.

The result: the more effort you put into crafting an agent, the more locked-in it becomes. There's no equivalent of emailing someone an app or sharing a repo link. The knowledge and configuration you pour into an agent has nowhere portable to go.

---

## AgentOnAir Agent Registry

Along with the `.agent` format, AgentOnAir ships a public registry — a curated collection of ready-to-use agents that anyone can browse, try, and download.

The registry is not a store. There are no purchases, no installs in the traditional sense, and no accounts required to try an agent. It works more like a public library of `.agent` files where every entry is fully transparent: you can see exactly what the agent does and how it behaves before you run it.

### What's in the registry

| Agent | What it does |
|---|---|
| Research Assistant | Deep-dives any topic and returns structured, sourced answers |
| Code Reviewer | Reads through code and explains issues clearly in plain language |
| Data Analyst | Takes raw data and surfaces patterns, trends, and summaries |
| Tweet Writer | Turns rough ideas into polished, high-engagement threads |
| Meeting Summarizer | Converts transcripts and notes into clean, structured summaries |
| SQL Debugger | Diagnoses broken queries and explains what went wrong |

---

## What AgentOnAir Is Not

AgentOnAir is not a new way to build agents. It doesn't ask you to change how you work or switch to a new platform. It's a format for what happens *after* you build — the sharing step that currently doesn't exist.

It's also not a platform you have to stay inside. The whole point is the opposite: a `.agent` file works independently of where it came from and where it's going.

---

*AgentOnAir — agents should travel.*
