import React, { useMemo, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    pointerWithin
} from '@dnd-kit/core';
import { Project, Task, COLUMNS, ColumnId } from '../../types';
import { Column } from '../Column';
import { SortableTask } from '../SortableTask';
import { useDnd, dropAnimation } from '../../hooks/useDnd';

interface BoardProps {
    activeProject: Project;
    updateProjectColumns: (projectId: string, newColumns: Record<ColumnId, Task[]>) => void;
    // Actions for Tasks
    addTask: (projectId: string, columnId: ColumnId, content: string) => void;
    updateTask: (projectId: string, taskId: string, updates: Partial<Task>) => void;
    deleteTask: (projectId: string, taskId: string) => void;
    addChildTask: (projectId: string, parentId: string, content: string) => void;
    moveToColumn: (projectId: string, taskId: string, targetColId: ColumnId) => void;
    cloneTask: (projectId: string, taskId: string) => void;
    updateWipLimit: (projectId: string, limit: number) => void;
    countLeaves: (tasks: Task[]) => number;
}

export const Board: React.FC<BoardProps> = ({
    activeProject,
    updateProjectColumns,
    addTask,
    updateTask,
    deleteTask,
    addChildTask,
    moveToColumn,
    cloneTask,
    updateWipLimit,
    countLeaves
}) => {
    const {
        activeTask,
        dragState,
        autoGroupState,
        sensors,
        onDragStart,
        onDragOver,
        onDragEnd
    } = useDnd({ activeProject, updateProjectColumns });

    const wipCount = useMemo(() =>
        countLeaves(activeProject.columns['in-progress'])
        , [activeProject, countLeaves]);

    // Progress Calculation Logic
    const progressMap = useMemo(() => {
        const map = new Map<string, { completed: number; total: number }>();
        
        // 1. Build Done Set (IDs in Done Column)
        const doneSet = new Set<string>();
        const traverseDone = (tasks: Task[]) => {
            tasks.forEach(t => {
                doneSet.add(t.id);
                if(t.sourceId) doneSet.add(t.sourceId);
                traverseDone(t.children);
            });
        };
        traverseDone(activeProject.columns['done']);

        // 2. Group all tasks by Identity to find "Homologous Parents"
        const parentsByIdentity = new Map<string, Task[]>();
        const allTasks: Task[] = [];
        
        const traverseAll = (tasks: Task[]) => {
            tasks.forEach(t => {
                allTasks.push(t);
                const identity = t.sourceId || t.id;
                if (!parentsByIdentity.has(identity)) {
                    parentsByIdentity.set(identity, []);
                }
                parentsByIdentity.get(identity)!.push(t);
                traverseAll(t.children);
            });
        };
        Object.values(activeProject.columns).forEach(col => traverseAll(col));

        // 3. Calculate progress for each task
        allTasks.forEach(task => {
             const identity = task.sourceId || task.id;
             const siblings = parentsByIdentity.get(identity) || [task];
             
             const distinctChildren = new Set<string>(); // Stores child identities
             
             siblings.forEach(p => {
                 p.children.forEach(c => {
                     distinctChildren.add(c.sourceId || c.id);
                 });
             });
             
             const total = distinctChildren.size;
             let completed = 0;
             distinctChildren.forEach(childIdentity => {
                 if (doneSet.has(childIdentity)) {
                     completed++;
                 }
             });
             
             map.set(task.id, { completed, total });
        });

        return map;
    }, [activeProject]);

    const getProgress = useCallback((taskId: string) => {
        return progressMap.get(taskId) || { completed: 0, total: 0 };
    }, [progressMap]);

    return (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
            >
                <div className="flex h-full w-full gap-4">
                    {COLUMNS.map(col => (
                        <Column
                            key={col.id}
                            id={col.id}
                            title={col.label}
                            tasks={activeProject.columns[col.id]}
                            onAddTask={(content) => addTask(activeProject.id, col.id, content)}
                            onUpdateTask={(id, updates) => updateTask(activeProject.id, id, updates)}
                            onDeleteTask={(id) => deleteTask(activeProject.id, id)}
                            onAddChild={(parentId, content) => addChildTask(activeProject.id, parentId, content)}
                            onMoveToColumn={(taskId, targetColId) => moveToColumn(activeProject.id, taskId, targetColId)}
                            onClone={(taskId) => cloneTask(activeProject.id, taskId)}
                            wipLimit={col.id === 'in-progress' ? activeProject.wipLimit : undefined}
                            onUpdateWipLimit={(limit) => updateWipLimit(activeProject.id, limit)}
                            currentWipCount={col.id === 'in-progress' ? wipCount : undefined}
                            dragState={dragState}
                            getProgress={getProgress}
                        />
                    ))}
                </div>
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeTask ? (
                        <div className="opacity-90 rotate-2 cursor-grabbing">
                            <SortableTask
                                task={activeTask}
                                onDelete={() => { }}
                                onUpdate={() => { }}
                                onAddChild={() => { }}
                                onMoveToColumn={() => { }}
                                onClone={() => { }}
                                dragState={null}
                                isOverlay={true}
                                autoGroupState={autoGroupState}
                                getProgress={getProgress}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};
