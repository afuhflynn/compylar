# Compylar Product Vision

## 1. Executive Summary

Compylar is an Engineering Intelligence Platform built around a core primitive: the Knowledge Compiler.

Most AI coding agents repeatedly rediscover a repository every time they work. They inspect files, infer architecture, identify patterns, reconstruct domain knowledge, and then discard much of that understanding when the session ends. Humans do not work this way. Experienced engineers build long-term understanding of a codebase and retrieve only the knowledge needed for the task at hand.

Compylar turns repositories into persistent engineering knowledge. It continuously compiles source code, documentation, history, architecture, conventions, and design intent into a reusable Repository Brain. That Repository Brain can then provide precise working context to Codex, Claude Code, Cursor, Windsurf, Continue, Goose, Cline, Aider, OpenCode, and future AI coding agents.

Compylar is not another IDE, chatbot, or vector database. It is the intelligence layer between repositories and AI agents.

## 2. Core Thesis

The context window should be treated as working memory, not long-term memory.

Repository understanding should live outside the model context window. The model should receive only the smallest useful working context for the current task. Compylar exists to compile, maintain, retrieve, and deliver that context.

The long-term architecture is:

```text
Repository
  ↓
Knowledge Compiler
  ↓
Repository Brain
  ↓
Context Builder
  ↓
AI Runtime / MCP / CLI / SDK
  ↓
Any AI Coding Agent
```

## 3. Product Positioning

Compylar is:

- an Engineering Intelligence Platform
- a Knowledge Compiler
- a Repository Brain
- persistent engineering memory
- repository intelligence infrastructure
- a context builder for AI coding agents

Compylar is not:

- another AI IDE
- another code editor
- another chatbot
- another basic repository indexer
- another vector database wrapper
- a tool that assumes LLMs should do all analysis

## 4. Design Principles

Compylar should prioritize:

- deterministic systems first
- AI only where it adds value
- low latency
- low token usage
- low memory usage
- low bandwidth usage
- low AI cost
- incremental compilation
- repository-specific knowledge
- agent interoperability
- enterprise readiness
- security and permission correctness
- maintainability over cleverness

LLMs are one component of Compylar. They are not the foundation.

## 5. Core Concepts

### Knowledge Compiler

The Knowledge Compiler transforms a repository into reusable engineering knowledge.

It should compile:

- ASTs
- import and export graphs
- dependency graphs
- module graphs
- call graphs
- architecture graphs
- API contracts
- data models
- control flow
- data flow
- framework conventions
- domain concepts
- design decisions
- engineering intent
- technical debt
- documentation
- repository history
- team conventions
- test strategy
- deployment behavior

The output is not just embeddings. The output is structured knowledge.

### Repository Brain

Every repository should have its own Repository Brain.

The Repository Brain stores durable understanding about:

- what the system does
- how it is structured
- how modules relate
- where important behavior lives
- what conventions the codebase follows
- what risks and constraints exist
- how the system has evolved
- what context an agent needs for a given task

The Repository Brain should evolve after every meaningful repository change.

### Working Memory

The model context window is working memory.

Compylar should retrieve, compress, and deliver the smallest useful context for the task. The agent should not need to load the whole repository to make a targeted change.

### Technology Brain

Compylar should eventually maintain a separate Technology Brain that tracks external technical knowledge:

- official documentation
- framework releases
- language updates
- security advisories
- migration guides
- RFCs
- best practices
- ecosystem changes

Repository knowledge and external technology knowledge should be related but stored separately.

## 6. Target Users

### Individual Developers

Developers use Compylar to help AI agents understand their codebase faster and make more accurate changes.

### Engineering Teams

Teams use Compylar as shared long-term engineering memory across developers, branches, machines, sessions, and AI tools.

### AI Coding Agents

Agents use Compylar as a repository intelligence layer instead of repeatedly scanning the same codebase.

### Platform and DevEx Teams

Platform teams use Compylar to standardize repository understanding, improve onboarding, enforce conventions, and reduce wasted AI spend.

### Enterprises

Enterprises use Compylar to give AI agents safe, permission-aware, auditable access to engineering context.

## 7. Major Product Surfaces

### CLI

The CLI is the first developer-facing interface.

It should support:

- initializing a Repository Brain
- compiling repository knowledge
- detecting changes
- generating context packs
- inspecting architecture
- exporting summaries
- integrating with local agents

### MCP Server

The MCP server should expose repository intelligence to external agents.

It should support:

- context hydration
- repository queries
- architecture summaries
- file relevance ranking
- session hooks
- pre-tool hooks
- task-specific context retrieval

### SDK

The SDK should allow applications and agents to consume Compylar programmatically.

### REST API

The REST API should support hosted and enterprise use cases.

### Web Platform

The web platform should provide:

- repository dashboards
- architecture maps
- knowledge quality indicators
- team management
- billing
- repository sync status
- organization-level governance

### Hosted Agent

Compylar may include its own hosted AI coding agent, but external agents must remain first-class citizens. The product should never lock users into one agent.

## 8. System Architecture

The long-term system should include:

- Repository Synchronizer
- Change Detector
- Knowledge Compiler
- Repository Brain
- Context Builder
- Agent Runtime
- MCP Layer
- CLI
- SDK
- API
- Web Platform
- Database Layer
- Event Bus
- Background Job System
- Model Router
- Technology Intelligence Engine
- Research Engine
- Security and Permissions Layer
- Observability Layer
- Billing and Subscription System

## 9. Repository Synchronization

Compylar should detect repository changes from:

- human developers
- Codex
- Claude Code
- Cursor
- Windsurf
- Git merges
- pull requests
- cherry-picks
- rebases
- branch switches
- external automation

Git should be a primary source of truth.

Compylar should use:

- commit hashes
- branch names
- tags
- diffs
- merge history
- pull request metadata
- repository fingerprints
- knowledge versions
- checkpoints

## 10. Incremental Compilation

Compylar should avoid full recompilation whenever possible.

When code changes, it should determine:

- which files changed
- which symbols changed
- which modules depend on those symbols
- which knowledge is stale
- which summaries need regeneration
- which graphs need updates
- which context packs may be invalid

The goal is to update only affected knowledge.

## 11. AI Strategy

Compylar should prefer deterministic analysis for anything deterministic systems can reliably do.

Use deterministic systems for:

- parsing
- symbol extraction
- dependency analysis
- route detection
- API surface detection
- file fingerprinting
- change detection
- graph construction

Use AI for:

- architecture summarization
- design intent extraction
- task interpretation
- context synthesis
- documentation synthesis
- research synthesis
- ambiguity resolution
- planning support

This keeps Compylar cheaper, faster, more explainable, and more reliable.

## 12. Security Model

Compylar must be designed for secure engineering environments.

Long-term requirements:

- repository-level permissions
- organization-level permissions
- branch-aware access
- secret detection
- sensitive file exclusion
- audit logs
- encrypted storage
- isolated background jobs
- least-privilege external integrations
- no accidental leakage of private code to unauthorized tools

The Repository Brain should never become a permission bypass.

## 13. Enterprise Model

Enterprise Compylar should support:

- organizations
- teams
- projects
- repositories
- SSO
- RBAC
- audit logs
- private deployment
- compliance controls
- data retention policies
- model routing controls
- per-repository AI policies
- cost controls

## 14. Business Model

Possible pricing dimensions:

- number of repositories
- repository size
- number of developers
- number of context generations
- background compilation volume
- hosted agent usage
- enterprise governance features

Initial monetization should likely focus on developer teams and organizations rather than individual hobby usage.

## 15. Long-Term Roadmap

### Phase 0: Hackathon MVP

Local CLI for TypeScript/Next.js repositories.

### Phase 1: Local Developer Tool

Robust CLI, better repository analysis, local context generation, and support for common agent workflows.

### Phase 2: MCP Server

Expose Repository Brain data to Codex and other agents through MCP.

### Phase 3: Hosted Repository Brain

Sync repositories, run background compilation, provide dashboards, and support teams.

### Phase 4: Multi-Agent Intelligence Layer

Allow multiple AI agents to consume and update shared repository knowledge.

### Phase 5: Enterprise Platform

Security, permissions, governance, observability, billing, and large-scale repository intelligence.

### Phase 6: Technology Brain

Continuously research frameworks, security updates, migration guides, and official documentation.

### Phase 7: Engineering Intelligence Network

Compylar becomes the default intelligence layer between repositories and all AI software engineering agents.

## 16. Open Questions

- What is the minimum knowledge schema that proves the Knowledge Compiler concept?
- Which agent integration should be first-class after the CLI?
- How should Repository Brain quality be measured?
- What knowledge should be deterministic, AI-generated, or hybrid?
- How should stale knowledge be surfaced to users?
- What is the right hosted data model for enterprise security?
- How should Compylar handle monorepos?
- How should Compylar support non-TypeScript languages?
- What should be stored locally versus remotely?
- How should users inspect, correct, or teach the Repository Brain?

## 17. Product North Star

Compylar wins if AI coding agents become meaningfully better because they no longer start every task from zero.

The product should make this visible:

- less context loaded
- fewer irrelevant files inspected
- better first-pass plans
- fewer wrong edits
- faster onboarding to unfamiliar repositories
- lower token spend
- more persistent engineering knowledge

The long-term goal is simple:

Compylar should become the engineering memory layer for the AI software development era.
