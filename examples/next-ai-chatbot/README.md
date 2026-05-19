# Next AI Chatbot Example

This is a plain Next.js chatbot scaffold.

It includes two implementations as separate Next routes:

* Plain React: stream state lives in component `useState`
* signal-kernel: stream state is owned by a reactive graph and rendered through `@signal-kernel/react`

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
* stream cancellation behavior
* stale chunk prevention
* partial assistant message state
* future snapshot/checkpoint boundaries
