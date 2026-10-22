import type { EncoTask, EncoTaskStatus, NewEncoTask, TaskAssigneeUser } from '../types/tasks';

export class TaskApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TaskApiError';
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new TaskApiError('Nie można połączyć się z serwerem ENCO Flow. Sprawdź połączenie i spróbuj ponownie.', 0);
  }

  const rawBody = await response.text();
  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    // Serwer po błędzie może zwrócić stronę HTML zamiast odpowiedzi JSON.
  }

  if (!response.ok) {
    const serverMessage =
      (typeof body?.error === 'string' && body.error) ||
      (typeof body?.message === 'string' && body.message);
    const diagnostic = serverMessage || (
      rawBody.trim().startsWith('<')
        ? 'Serwer zwrócił stronę HTML zamiast danych API.'
        : rawBody.trim().slice(0, 180)
    );
    throw new TaskApiError(
      diagnostic
        ? `Operacja na zadaniu nie powiodła się (HTTP ${response.status}): ${diagnostic}`
        : `Operacja na zadaniu nie powiodła się (HTTP ${response.status}). Spróbuj ponownie.`,
      response.status
    );
  }

  if (!rawBody.trim()) return {} as T;
  if (Object.keys(body).length === 0 && rawBody.trim().startsWith('<')) {
    throw new TaskApiError('Serwer zwrócił stronę HTML zamiast danych API. Sprawdź, czy aplikacja jest uruchomiona w aktualnej wersji.', response.status);
  }
  return body as T;
}

export async function fetchTasks(): Promise<EncoTask[]> {
  const result = await requestJson<{ tasks: EncoTask[] }>('/api/tasks');
  return Array.isArray(result.tasks) ? result.tasks : [];
}

export async function fetchTaskAssignees(): Promise<TaskAssigneeUser[]> {
  const result = await requestJson<{ users: TaskAssigneeUser[] }>('/api/tasks/meta');
  return Array.isArray(result.users) ? result.users : [];
}


export async function createTask(input: NewEncoTask): Promise<EncoTask> {
  const result = await requestJson<{ task: EncoTask }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.task;
}

export async function updateTaskStatus(taskId: string, status: EncoTaskStatus): Promise<EncoTask> {
  const result = await requestJson<{ task: EncoTask }>('/api/tasks/' + encodeURIComponent(taskId), {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await requestJson<{ success: boolean }>('/api/tasks/' + encodeURIComponent(taskId), {
    method: 'DELETE',
  });
}
