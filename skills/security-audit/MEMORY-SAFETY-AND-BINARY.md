# Memory Safety and Binary

For C/C++/Rust-unsafe, kernel modules, parsers/decoders, runtimes/JITs, firmware, reverse-engineering tooling. The web-oriented classes in [ATTACK-CLASSES.md](ATTACK-CLASSES.md) fit poorly here; use these instead, or alongside them for hybrid targets (e.g., a C++ backend with an HTTP front).

## Attacker position

A memory-corruption finding is useless without a position. Always declare which one:

- **`EXTERNAL`** — untrusted input from the public internet reaches the buggy code path (HTTP server, network parser, public IPC socket).
- **`LOCAL`** — local user land; SUID/LPE path or any locally-reachable binary.
- **`IN_CLUSTER`** — pod-to-pod / container-to-container in an orchestrator.
- **`HOST_SYSTEM`** — hypervisor/host-OS attacking software it hosts (guest driver, enclave runtime, firmware target). Note: the *reverse* direction (guest→host, sandbox→outside, enclave→host) is `LOCAL`, never `HOST_SYSTEM`.
- **`SUPPLY_CHAIN`** — build-time or dependency-modification prerequisite.
- **`PHYSICAL_TEMPORARY` / `PHYSICAL_LONG_TERM`** — fault injection, side-channel, evil maid, USB. `TEMPORARY` for brief contact (NFC, USB); `LONG_TERM` for persistent or chip-level (JTAG, decapping).

If the code is reachable only after crossing a trust boundary owned by a trusted-by-design component (proxy, gateway, message queue), trace back to the outermost boundary the untrusted actor crosses — that, not the immediate protocol peer, is the position.

## Attack classes

### Stack memory corruption
- Stack buffer overflow → control return address, saved frame pointer, saved registers.
- Stack-based variable overwrite (off-by-one, struct-field confusion).
- **Stack canaries** (`-fstack-protector`, `-fstack-protector-strong`, `-fstack-protector-all`): check whether canary is present and whether leak primitives exist. A leaked canary is a finding; an un-leaked canary is not bypassed.
- **Shadow stack** (Intel CET, ARM BTI): check whether enabled; if so, classic ROP is largely defeated.
- **ASLR**: is PIE on? Is the binary position-independent? Are libraries randomized? An info leak (see "Memory disclosure" below) defeats ASLR — chain them.

### Heap memory corruption
- Heap overflow / underflow → corrupt adjacent chunk metadata or app data.
- Use-after-free (UAF): dangling pointer reused after `free`. Check free-list allocator type (ptmalloc, jemalloc, scudo, mimalloc, tcmalloc, Glibc 2.36+ safe-linking) — exploitation strategy depends heavily on it.
- Double-free → free-list corruption.
- Type confusion → wrong vtable / wrong method called.
- **Heap grooming** required: heap feng shui, cross-cache attacks (Linux slab), page-level heap spray. A "potential" UAF is not a finding unless you can describe the grooming that makes it triggerable.
- **Allocators worth fingerprinting**: ptmalloc (glibc), musl, jemalloc, scudo (Android/LLVM), mimalloc, tcmalloc, tbbmalloc, snmalloc, Glibc 2.36+ safe-linking on fastbin. Each has a different free-list shape.

### Integer / arithmetic bugs
- Signed/unsigned comparison (`size_t` vs `int`, loop bound).
- Integer overflow on allocation size → undersized buffer followed by overflow.
- Truncation when narrowing (`uint64_t` → `uint32_t`).
- Underflow on unsigned subtraction.
- Off-by-one in length calculations.

### Format string
- `printf(user_data)` — `%n` write primitive, `%s` read primitive, `%x` leak primitive.
- Check for `fmt`-style APIs (`PyObject_Format`, Rust `format!`, custom formatters) that accept user-controlled format strings.

### Race conditions
- TOCTOU between check and use (file, syscall, memory).
- Data races on shared mutable state without synchronization (`_Atomic`, `Mutex`, `RwLock`, atomic ops, memory barriers). Rust `unsafe` blocks that share `UnsafeCell` across threads.
- Double-checked locking without proper memory ordering.

### Uninitialized memory
- Stack variable read before write (`-ftrivial-auto-var-init=pattern` is a hardening flag, not a fix).
- Heap allocation read before initialization (calloc vs malloc).
- Leaked kernel stack/heap to userspace.

### Memory disclosure (info leak)
- Uninitialized padding bytes in structs sent over the wire.
- Short reads returning slack buffer contents.
- Out-of-bounds read whose output is reflected to the attacker.
- These are the **ASLR/PIE bypass primitives** that make the second-stage corruption finding exploitable — record them as **enablers**, not standalone findings, and chain them in Phase 2.5 (see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md)).

### Logic & interface contract bugs (native-specific)
A function documents a safety contract (e.g., "caller must allocate `buf` of size N") and the audit must check **every call site**:
- Does every caller allocate the right size?
- Does every caller bound-check the input?
- A safe function whose callers all misuse it = a finding at the call sites, not the function.
- A safe function whose callers all use it safely = no finding.

### SIMD / vector padding
Optimized NEON / SSE / AVX / VSX routines often read past the logical end of a row because vectors are wider than the pixel stride. **Do not flag as OOB** if the library uses a global allocator contract (e.g., `png_malloc(row_bytes + 16)`). The OOB access is mathematically within the pre-allocated padding. Verify the contract — see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md) negative constraint 11.

### JIT / dynamic code
- JIT spray, const pool crafting.
- RWX pages (should be W^X — write XOR execute).
- Self-modifying code without verification.

### Fuzzing (the right way)
- **Build with sanitizers** (`-fsanitize=address,undefined,memory`) — a crash under ASan/UBSan is a real bug; a crash without sanitizers may be benign.
- **Respect allocator invariants**: a PoC that bypasses the library's `png_malloc`/`av_malloc` wrappers and feeds a custom `malloc(15)` to a private static function is an artificial crash — see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md) rule on "Internal Invariant Protection". Use public APIs or respect global allocator padding.
- **Run reproducer through public API**: a private/static-function harness is an artificial crash. If you cannot trigger via public API, classify `failed_to_reproduce` due to "Internal Invariant Protection".
- **Crash classification**: ASan error output, SIGSEGV (exit 139), SIGABRT (exit 134), core dump → `reproduced`. Logic bugs → functional test exit 0 with unexpected result.

## Reproduction (Phase 2.5 / Phase 6)

For memory-safety findings, **statically argued ≠ confirmed**. Where the target is locally buildable:

1. Extract the suspect code into a minimal standalone harness, OR build the whole target with ASan+UBSan.
2. Feed the payload that should trigger the bug.
3. Capture: exit code, ASan report, stack trace, register dump.
4. **Re-attack**: after a patch lands, write a *new* payload variant aiming to bypass the patch. Only if the re-attack also fails is the patch actually verified. See [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md) Phase 6.
5. **Host isolation**: never run reproducers directly on the host. Use a container / sandbox / VM. Restrict network and filesystem writes for memory-safety PoCs; you may enable local services for logic/auth tests, never expose to the internet.

## Outputs (compile into the finding)

A confirmed memory-safety finding must include:
- The exact `code_paths` (`file.c:line`) of the flawed block — strip helper/test harness files from `code_paths`.
- The allocator type and any padding contract (so downstream can re-check viability).
- The attacker position (see above).
- The PoC file path and run command (in the reproducer dir, never in the source tree).
- Whether canaries / ASLR / shadow stack / W^X are in play, and whether a leak primitive is needed.
- The reproduction status: `reproduced` / `failed_to_reproduce` / `statically_confirmed` (last resort, for hardcoded secrets only) / `not_attempted`.

## Production viability gate

A memory bug is not actionable if it only triggers in:
- Debug builds where `assert()` / `debug_abort()` fires and `NDEBUG` strips them in release → **`NON_VIABLE`** (disabled-assertion trap).
- `#ifdef DEBUG` conditionally-compiled paths → **`NON_VIABLE`** (debug-only feature).
- Standard non-configurable environmental controls (kernel sandbox, read-only FS) → **`NON_VIABLE`** (blocked by environment).
- Sample/test/example code → **`SAMPLE_OR_TEST`**.
- Non-default configs / optional flags → **`CONDITIONAL_VIABLE`**.
- A standard release build → **`VIABLE`**.

This gate applies in Phase 3 (validation) — see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md).
