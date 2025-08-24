# Claude Code Configuration

## Project Information

This is an MCP server that provides persistent memory storage for Claude.ai Pro users using **serverless Cloudflare infrastructure**.

**IMPORTANT**: The comprehensive project plan and architecture is in `PROJECT_PLAN.md` - always refer to this file for implementation details, data models, and development phases.

**IMPORTANT**: Keep `@PROJECT_PLAN.md` up to date with the latest changes and progress.

## Architecture Summary

- **Cloudflare Durable Objects + SQLite**: Persistent storage
- **Cloudflare Vectorize**: Vector search for semantic similarity
- **Cloudflare Workers**: Serverless MCP server runtime
- **Fully serverless**: Pay-per-request pricing with zero cold starts

## Development Status

Currently in Phase 1 (Foundation) - project structure needs to be created according to the Cloudflare Workers architecture outlined in PROJECT_PLAN.md.

## Spell Check Exceptions

Technical terms to add to spell checker:
- Lucene, pgvector, Qdrant, VARCHAR, tsvector, modelcontextprotocol

- The MCP must be a secure remote MCP server
