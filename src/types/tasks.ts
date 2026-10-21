import type { AuthDepartmentId } from './auth';

export type EncoTaskStatus = 'todo' | 'in_progress' | 'done';
export type EncoTaskAssigneeType = 'department' | 'person';

export interface EncoTask {
  id: string;
  orderId: string;
  orderNumber: string;
  projectName: string;
  client: string;
  description: string;
  assigneeType: EncoTaskAssigneeType;
  assigneeDepartment?: AuthDepartmentId;
  assigneeUserId?: string;
  assigneeName: string;
  dueDate: string;
  status: EncoTaskStatus;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssigneeUser {
  id: string;
  username: string;
  displayName: string;
  departments: AuthDepartmentId[];
  isAdmin: boolean;
}

export interface NewEncoTask {
  orderId: string;
  description: string;
  dueDate: string;
  assigneeType: EncoTaskAssigneeType;
  assigneeDepartment?: AuthDepartmentId;
  assigneeUserId?: string;
}
