# OpenAI Build Week submission runbook

Verified on 2026-07-19 from the official [Devpost rules](https://openai.devpost.com/rules) and [Build Week FAQ](https://openai.devpost.com/details/faqs). Recheck the live pages immediately before submission.

## Non-negotiable requirements

- Submit by **July 21, 2026, 5:00 PM PDT**.
- Select **Developer Tools**. Compylar is persistent repository memory for coding agents, rather than an end-user application.
- Provide an English text description explaining the features and functionality.
- Provide a publicly visible YouTube demo under three minutes, with audio. It must clearly show what was built and how Codex and GPT-5.6 were used.
- Provide a testable code repository: public with an appropriate license, or private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- Include the primary build thread's Codex `/feedback` Session ID.
- If any work predated the submission period, distinguish the new work and preserve evidence of Codex/GPT-5.6 use during Build Week (dated commits and session evidence are acceptable examples in the rules).

## Submission package

1. Run `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm demo`, `pnpm benchmark`, and `pnpm verify:cli-bin` on the final revision.
2. Ensure the README contains installation, deterministic no-key workflow, optional AI boundary, agent-skill setup, and judge-ready testing commands.
3. Record the three-minute video using the existing demo flow: problem → compile → targeted context → change/status → refresh reuse → close.
4. In the video and description, state that Compylar was built with Codex/GPT-5.6 and explain the evidence-backed, no-key deterministic core.
5. Add the public repository URL, YouTube URL, track, text description, and `/feedback` Session ID to Devpost.

Use [the prepared Devpost description and video narration](DEVPOST_SUBMISSION_DRAFT.md) as the starting point. Replace its three form placeholders only with real submission links and the primary-session ID.

## Pre-submit review

- [ ] Repository access and license are correct for judges.
- [ ] README setup works from a clean clone.
- [ ] Video is public, audible, English, and under three minutes.
- [ ] Video shows the working product rather than slides alone.
- [ ] Description explains the problem, the persistent-memory workflow, and Codex/GPT-5.6 usage.
- [ ] Primary Codex `/feedback` Session ID is captured.
- [ ] Submission form fields and links have been opened and verified before the deadline.
