'use client';

import { TransportType, useTransport } from '@/lib/useTransport';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  buttonGroup: {
    display: 'flex',
    gap: '5px',
  },
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    transition: 'all 0.2s',
  },
  activeButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    borderColor: '#2196F3',
  },
  indicator: {
    fontSize: '12px',
    color: '#666',
    marginLeft: 'auto',
  },
};

export function TransportToggle() {
  const { transport, setTransport, isLoaded } = useTransport();

  if (!isLoaded) {
    return (
      <div style={styles.container}>
        <span style={styles.label}>Transport:</span>
        <span style={styles.indicator}>Loading...</span>
      </div>
    );
  }

  const handleTransportChange = (newTransport: TransportType) => {
    if (newTransport !== transport) {
      setTransport(newTransport);
    }
  };

  return (
    <div style={styles.container}>
      <span style={styles.label}>Subscription Transport:</span>
      <div style={styles.buttonGroup}>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(transport === 'websocket' ? styles.activeButton : {}),
          }}
          onClick={() => handleTransportChange('websocket')}
        >
          WebSocket
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(transport === 'sse' ? styles.activeButton : {}),
          }}
          onClick={() => handleTransportChange('sse')}
        >
          SSE (GET)
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(transport === 'sse-post' ? styles.activeButton : {}),
          }}
          onClick={() => handleTransportChange('sse-post')}
        >
          SSE (POST)
        </button>
      </div>
      <span style={styles.indicator}>
        {transport === 'websocket'
          ? 'ws://localhost:3000/graphql'
          : transport === 'sse'
            ? 'EventSource GET /api/graphql/sse'
            : 'fetch POST /api/graphql/sse'}
      </span>
    </div>
  );
}
