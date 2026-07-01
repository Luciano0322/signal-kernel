# Next AI Chatbot Example

This is a Next.js chatbot streaming example.

It includes two implementations as separate Next routes:

* Plain React: the same streaming policy is implemented inside component state
* signal-kernel: the streaming policy is owned by a reactive graph and rendered through `@signal-kernel/react`

The API route is shared by both pages:

```txt
app/page.tsx
  -> links to the two implementations

app/plain/page.tsx
  -> renders the plain React chatbot route

app/signal-kernel/page.tsx
  -> renders the signal-kernel chatbot route

app/api/chat/route.ts
  -> accepts POST /api/chat
  -> returns a streaming Response

app/components/ChatPanel.tsx
  -> shared client component for input, submit, stop, and message rendering

app/plain/PlainChatPanel.tsx
  -> calls fetch("/api/chat") directly
  -> appends chunks into React component state

app/signal-kernel/chatGraph.ts
  -> owns messages, active request, and stream resource state

app/signal-kernel/KernelChatPanel.tsx
  -> renders the graph through React adapter hooks
```

The API route uses a mock token stream, so no provider API key is required.

## Streaming Policy

Both routes intentionally use the same user-facing policy:

```txt
single active assistant stream
keep partial text on cancel
keep partial text on error
```

The policy is:

* Submit is allowed only when no assistant stream is active.
* The input can still be edited while streaming.
* A second submit is blocked while streaming.
* Stop cancels the active stream and keeps the partial assistant text.
* Stream errors keep the partial assistant text and mark the message as error.
* Successful streams commit the assistant draft as a done message.

This example does not auto-cancel a previous stream, run multiple assistant streams in parallel, retry failed streams, or resume interrupted streams.

To exercise the error path, send a prompt containing `error`, `fail`, or `interrupt`. The mock route emits partial text first, then interrupts the stream so both routes can demonstrate that partial assistant text is preserved.

## Why Two Routes

The plain React route is not intentionally broken. It is the control case.

```txt
Plain React
  owns messages in useState
  owns isStreaming in useState
  owns AbortController in a ref
  owns partial draft mutation
  owns cancel/error policy
```

The signal-kernel route moves the same workflow policy into `chatGraph`.

```txt
signal-kernel
  graph owns input / messages / activeAssistant / request
  createStreamResource owns stream status and partial value
  React consumes readable graph values with useKernelValue(...)
  React consumes graph.stream with useStreamResource(graph.stream)
  React event handlers only call graph actions
```

The comparison is about ownership, not about making the plain route fail.

Each route renders a small ownership panel above the chat transcript:

* State owner
* Stream owner
* Policy owner
* Render bridge

The user-facing behavior should stay aligned across both routes. The panel exists to make the architectural boundary visible.

## Run

```sh
pnpm -F @signal-kernel/example-next-ai-chatbot dev
```

The dev server uses port `5176`.

## Build

```sh
pnpm -F @signal-kernel/example-next-ai-chatbot build
```

## Why This Exists

This is the control example for a future streaming runtime RFC.

The two routes make the comparison explicit:

* plain React component state
* signal-kernel graph ownership
* single-active-stream policy
* stream cancellation behavior with partial text preserved
* stream error behavior with partial text preserved
* partial assistant message state
* future snapshot/checkpoint boundaries
