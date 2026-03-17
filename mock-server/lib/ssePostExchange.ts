'use client';

import { Exchange, Operation, OperationResult } from 'urql';
import { pipe, filter, merge, mergeMap, make, share, takeUntil } from 'wonka';

interface SSEPayload {
  payload?: {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };
  data?: unknown;
}

function isSubscriptionOperation(operation: Operation): boolean {
  return operation.kind === 'subscription';
}

function createSSEPostSource(operation: Operation) {
  return make<OperationResult>(({ next, complete }) => {
    const { query, variables } = operation;
    const queryString = typeof query === 'string' ? query : query.loc?.source.body;

    const url = '/api/graphql/sse';
    const body = JSON.stringify({
      query: queryString,
      variables: variables ?? undefined,
    });

    const controller = new AbortController();

    fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          next({
            operation,
            data: undefined,
            error: {
              name: 'SSEError',
              message: `HTTP ${response.status}`,
              graphQLErrors: [],
              networkError: new Error(`SSE request failed: ${response.status}`),
            } as OperationResult['error'],
            extensions: undefined,
            stale: false,
            hasNext: false,
          });
          complete();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\n\n+/);
            buffer = events.pop() ?? '';

            for (const eventBlock of events) {
              const dataLines: string[] = [];
              for (const line of eventBlock.split('\n')) {
                if (line.startsWith('data:')) {
                  dataLines.push(line.slice(5).trimStart());
                }
              }
              const dataStr = dataLines.join('\n');
              if (!dataStr) continue;

              try {
                const parsed: SSEPayload = JSON.parse(dataStr);
                const payload = parsed.payload ?? parsed;
                const data = 'data' in payload ? payload.data : payload;
                const errors = 'errors' in payload ? payload.errors : undefined;

                next({
                  operation,
                  data,
                  error: errors
                    ? ({
                        name: 'GraphQLError',
                        message: errors[0]?.message ?? 'Unknown error',
                        graphQLErrors: errors,
                        networkError: undefined,
                      } as OperationResult['error'])
                    : undefined,
                  extensions: undefined,
                  stale: false,
                  hasNext: true,
                });
              } catch {
                // Skip invalid JSON
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        complete();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        next({
          operation,
          data: undefined,
          error: {
            name: 'SSEError',
            message: String(err.message ?? err),
            graphQLErrors: [],
            networkError: err instanceof Error ? err : new Error(String(err)),
          } as OperationResult['error'],
          extensions: undefined,
          stale: false,
          hasNext: false,
        });
        complete();
      });

    return () => {
      controller.abort();
    };
  });
}

/**
 * SSE exchange using HTTP POST with Accept: text/event-stream.
 * Mimics the scenario: POST request with JSON body, SSE response stream.
 * Use this to validate the extension's SSE POST parsing in the GraphQL Network Inspector.
 */
export const ssePostExchange: Exchange = ({ forward }) => {
  return (ops$) => {
    const sharedOps$ = share(ops$);

    const teardown$ = pipe(
      sharedOps$,
      filter((op: Operation) => op.kind === 'teardown')
    );

    const subscriptionResults$ = pipe(
      sharedOps$,
      filter(isSubscriptionOperation),
      mergeMap((operation: Operation) => {
        return pipe(
          createSSEPostSource(operation),
          takeUntil(
            pipe(
              teardown$,
              filter((op: Operation) => op.key === operation.key)
            )
          )
        );
      })
    );

    const forward$ = pipe(
      sharedOps$,
      filter(
        (op: Operation) =>
          !isSubscriptionOperation(op) && op.kind !== 'teardown'
      ),
      forward
    );

    return merge([subscriptionResults$, forward$]);
  };
};
