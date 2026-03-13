'use client';

import { type Exchange, type Operation, type OperationResult } from 'urql';
import { pipe, filter, merge, mergeMap, make, share, takeUntil } from 'wonka';

// Supports both distinct connections (data: ExecutionResult) and legacy (data: { payload })
interface SSEPayload {
  payload?: {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };
  data?: unknown;
  errors?: Array<{ message: string }>;
}

function isSubscriptionOperation(operation: Operation): boolean {
  return operation.kind === 'subscription';
}

function createSSESource(operation: Operation) {
  return make<OperationResult>(({ next, complete }) => {
    const { query, variables } = operation;

    // Build URL with query params for EventSource (GET-based)
    const queryString = typeof query === 'string' ? query : query.loc?.source.body;
    const params = new URLSearchParams();
    params.set('query', queryString || '');
    if (variables) {
      params.set('variables', JSON.stringify(variables));
    }

    const url = `/api/graphql/sse?${params.toString()}`;
    const eventSource = new EventSource(url);

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed: SSEPayload = JSON.parse(event.data);
        const payload = parsed.payload ?? parsed;
        const data = 'data' in payload ? payload.data : undefined;
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
    };

    // Server sends event: next (GraphQL over SSE protocol); onmessage only catches default "message" type
    eventSource.addEventListener('next', handleMessage);
    eventSource.onmessage = handleMessage; // fallback for event: message or no event line

    eventSource.onerror = () => {
      next({
        operation,
        data: undefined,
        error: {
          name: 'SSEError',
          message: 'EventSource connection error',
          graphQLErrors: [],
          networkError: new Error('EventSource connection failed'),
        } as OperationResult['error'],
        extensions: undefined,
        stale: false,
        hasNext: false,
      });
      eventSource.close();
      complete();
    };

    return () => {
      eventSource.close();
    };
  });
}

export const sseExchange: Exchange = ({ forward }) => {
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
          createSSESource(operation),
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
      filter((op: Operation) => !isSubscriptionOperation(op) && op.kind !== 'teardown'),
      forward
    );

    return merge([subscriptionResults$, forward$]);
  };
};
