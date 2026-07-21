# Language-Neutral Compiler and Adapter Design

## Goal

Compylar must provide persistent engineering memory for any repository, not only
TypeScript, Next.js, or Prisma projects. The core must preserve its local,
deterministic, evidence-backed behavior while adapters prove language- and
framework-specific facts.

## Core module

The compiler core owns repository discovery, file hashing, package/workspace
boundaries, cache reuse, snapshots, freshness, evidence validation, learned
memory, retrieval, and context budgets. It stores normalized facts for
definitions, entities, routes, relationships, tests, entry points,
configuration, and documentation. Every fact identifies its producing adapter,
source range, confidence, and adapter-specific attributes.

Unsupported files still produce structural facts and remain tracked for
freshness. The Brain exposes adapter capability records so agents can distinguish
proven memory from a targeted-read requirement.

## Adapter seam

An adapter detects applicability, discovers supported files, extracts normalized
facts, and resolves only relationships it can prove. The core calls all active
adapters and reconciles their output by file hash and adapter version. Adapters
must return explicit unknown/unsupported diagnostics rather than guessing.

The current TypeScript/JavaScript, Next.js, and Prisma behavior becomes the first
adapter family. Python is the first independent proof adapter: Python modules,
imports, definitions, unittest/pytest tests, and FastAPI routes. Go and Rust
follow with module/crate, symbol, import/use, test, and conventional HTTP-route
adapters.

## Compatibility and safety

Existing CLI retrieval remains language-neutral; adapter-specific metadata is additive. `.env` values and other
secret content remain excluded. No AI or model download is required to activate
an adapter.

## Acceptance

Equivalent TypeScript and Python fixtures compile into the same normalized fact
categories; `memory`, `context`, `references`, `status`, learned memory, and
refresh work without language-specific commands. Capability output clearly shows
active, unavailable, and structural-only adapters. Tests cover cache reuse,
unsupported-language fallback, evidence citations, and no false runtime claims.
