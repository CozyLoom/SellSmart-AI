let memoryToken: string | null = null;

export function setMemoryToken(token: string | null) {
  memoryToken = token;
}

export function getMemoryToken(): string | null {
  return memoryToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = data?.code ? String(data.code) : undefined;
    this.data = data;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(
      String(json.error || `Request failed (${res.status})`),
      res.status,
      json
    );
  }

  return json as T;
}
