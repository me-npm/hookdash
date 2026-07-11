export function connectSSE(onMessage: (event: string, data: any) => void): () => void {
  const url = (import.meta as any).env.DEV ? 'http://localhost:9090/api/stream' : '/api/stream';
  const eventSource = new EventSource(url);

  eventSource.addEventListener('connected', (e: MessageEvent) => {
    onMessage('connected', JSON.parse(e.data));
  });

  eventSource.addEventListener('event:new', (e: MessageEvent) => {
    onMessage('event:new', JSON.parse(e.data));
  });

  eventSource.addEventListener('delivery:update', (e: MessageEvent) => {
    onMessage('delivery:update', JSON.parse(e.data));
  });

  eventSource.onerror = (err) => {
    console.error('SSE Error:', err);
  };

  return () => {
    eventSource.close();
  };
}

async function request(path: string, options: RequestInit = {}) {
  const prefix = (import.meta as any).env.DEV ? 'http://localhost:9090' : '';
  const response = await fetch(`${prefix}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Events
  getEvents: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v.toString());
      }
    }
    return request(`/api/events?${searchParams.toString()}`);
  },
  
  getEvent: (id: string) => request(`/api/events/${id}`),
  replayEvent: (id: string) => request(`/api/events/${id}/replay`, { method: 'POST' }),
  deleteEvent: (id: string) => request(`/api/events/${id}`, { method: 'DELETE' }),

  // Endpoints
  getEndpoints: () => request('/api/endpoints'),
  createEndpoint: (data: any) => request('/api/endpoints', { method: 'POST', body: JSON.stringify(data) }),
  updateEndpoint: (id: string, data: any) => request(`/api/endpoints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEndpoint: (id: string) => request(`/api/endpoints/${id}`, { method: 'DELETE' }),
  testEndpoint: (id: string) => request(`/api/endpoints/${id}/test`, { method: 'POST' }),

  // Stats
  getStats: () => request('/api/stats'),
};
