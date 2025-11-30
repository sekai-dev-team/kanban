export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'done';

export interface Task {
    id: string;
    content: string;
    createdAt: number;
    children: Task[];
    isExpanded?: boolean;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    wipLimit: number; // For In-Progress column
    columns: {
        [key in ColumnId]: Task[];
    };
    _version?: number;
}

export interface AppData {
    projects: Project[];
    activeProjectId: string | null;
    theme: 'light' | 'dark';
    _version?: number;
}

export const COLUMNS: { id: ColumnId; label: string }[] = [
    { id: 'backlog', label: 'Backlog' },
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
];
