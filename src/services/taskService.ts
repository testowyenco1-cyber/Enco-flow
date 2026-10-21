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
    throw new TaskApiError('Nie można połączyć się z serwerem ENCO Flow.', 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TaskApiError(
      typeof body?.error === 'string' ? body.error : 'Nie udało się wykonać operacji na zadaniu.',
      response.status
    );
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
