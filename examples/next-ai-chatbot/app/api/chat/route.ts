type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages?: ChatMessage[];
};

const encoder = new TextEncoder();

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user");
}

function buildMockAnswer(prompt: string) {
  return [
    `You asked: "${prompt}". `,
    "This is a plain Next.js streaming route. ",
    "The server returns chunks through a Web Response stream, ",
    "and the client reads response.body to update the assistant message. ",
    "No model provider is connected yet, so this is safe to run without an API key.",
  ];
}

function shouldInterruptStream(prompt: string) {
  return /\b(error|fail|interrupt)\b/i.test(prompt);
}

export async function POST(request: Request) {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUserMessage = getLastUserMessage(messages);

  if (!lastUserMessage?.content.trim()) {
    return Response.json({ error: "A user message is required" }, { status: 400 });
  }

  const prompt = lastUserMessage.content.trim();
  const chunks = buildMockAnswer(prompt);
  const interrupt = shouldInterruptStream(prompt);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const [index, chunk] of chunks.entries()) {
          await sleep(220, request.signal);
          controller.enqueue(encoder.encode(chunk));

          if (interrupt && index === 1) {
            controller.error(new Error("Mock stream interrupted after partial text."));
            return;
          }
        }

        controller.close();
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
