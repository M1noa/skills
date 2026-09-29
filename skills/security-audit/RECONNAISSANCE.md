# Reconnaissance

### Phase 1: Understand the application

Before looking for bugs, understand what you're auditing. This requires depth, not just a directory listing. Launch **multiple `research` agents in parallel** to map different aspects of the codebase:

**Agent 1a: Overview, tech stack, and comparable baseline**
```
Explore the codebase at <path>. Answer:
1. What is this application? What kind of software? (web app, API, CLI tool, library, daemon, desktop app, mobile backend, smart contract, embedded/firmware, etc.)
2. Who uses it and how? (end users, developers, operators, other services, other contracts)
3. What's the tech stack? (languages, frameworks, databases, runtime, deployment model, build system)
4. What comparable mainstream software exists? What security tradeoffs does the comparable accept?
5. What's the high-level directory structure?
Return specific file paths for key entry points.
```

**Agent 1b: Trust boundaries and access control**
```
Explore the codebase at <path>. Find and read ALL code related to:
1. Trust boundaries — where does untrusted input enter the system? (HTTP requests, CLI args, file reads, IPC, message queues, environment variables, config files, contract calls, etc.)
2. Authentication — how do callers prove identity? (sessions, tokens, API keys, mTLS, Unix sockets, wallet signatures, etc.) If there's no authentication, note that.
3. Authorization — how are permissions enforced? (middleware, decorators, capability checks, file permissions, contract modifiers, etc.) If there's no authorization model, note that.
4. Privilege separation — does the code run as root? Drop privileges? Sandbox? Fork workers?
5. Any bypass mechanisms (dev-only modes, test helpers, setup flows, debug flags).
Return the trust model: who are the actors, what can each do by design, and which code enforces it. Include specific file paths and line numbers.
```

**Agent 1c: Input surface inventory**
```
Explore the codebase at <path>. Produce a complete inventory of where external input enters the system:
1. Network-facing surfaces (HTTP endpoints, gRPC services, WebSocket handlers, TCP/UDP listeners, etc.) — list each with method/verb and purpose
2. File-based input (file uploads, config file parsing, log ingestion, import/export, etc.)
3. IPC and inter-service input (message queues, shared memory, Unix sockets, environment variables, CLI arguments)
4. User-generated content surfaces (anywhere users provide content that is stored and later rendered, served, or processed)
5. External integrations (OAuth, webhooks, third-party APIs, plugin loading, dynamic code execution, external contract calls)
6. All places where input reaches dangerous sinks (SQL/query builders, HTML/template output, file paths, shell commands, deserialization, eval, dynamic imports, low-level memory operations)
Return specific file paths. Be exhaustive.
```

**Agent 1d: Dependency and language/tooling profile**
```
Explore the codebase at <path>. Answer:
1. What languages and package managers are in play (package.json/lockfile, requirements.txt/pyproject.toml, go.mod, Cargo.toml, *.csproj, composer.json, Gemfile, pom.xml/build.gradle)?
2. List direct dependencies that touch security-sensitive functionality (auth, crypto, serialization, templating, HTTP clients, XML/YAML parsing).
3. Is there a CI pipeline that already runs any security tooling (SAST, dependency audit, SCA, fuzzers)? What does it check and what does it miss?
4. Any vendored/copied third-party code, git submodules, or binary blobs checked into the repo?
Return the exact commands to run per [TOOLING.md](TOOLING.md) for this stack, and the dependency file paths.
```

Collect all four agents' outputs and synthesize them into `<output-dir>/architecture.md`:
- 1-2 page structured summary covering application type, tech stack, trust model, input surfaces, dependency/tooling profile, and baseline comparable
- Include the key file paths from all agents — these become the starting points for Phase 2
- Run the applicable scanners from [TOOLING.md](TOOLING.md) now and fold notable hits into this summary as leads (not findings) for Phase 2 to verify
- This document is injected verbatim into every Phase 2 agent prompt

If Phase 1 reveals the codebase is larger or more complex than expected (a plugin system, multi-tenant architecture, complex auth chains, multiple deployment targets, a monorepo of several services in different languages), launch additional `research` agents to map those areas before proceeding. The quality of Phase 2 depends entirely on the quality of Phase 1.

