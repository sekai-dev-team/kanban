import React, { useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    pointerWithin // Changed: Use pointerWithin for strict cursor based detection
} from '@dnd-kit/core';
import { Project, Task, COLUMNS, ColumnId } from '../../types';
import { Column } from '../Column';
import { SortableTask } from '../SortableTask';
import { useDnd, dropAnimation } from '../../hooks/useDnd';

interface BoardProps {
    activeProject: Project;
    updateProjectColumns: (projectId: string, newColumns: Record<ColumnId, Task[]>) => void; // 用于 useDnd
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
    // Initialize DnD Hook
    // 注意：updateProjectColumns 已经在 useDnd 内部调用了，但这里我们传入的是一个能够更新全局 AppData 的函数
    // 我们的 hooks/useAppData 并没有直接暴露 updateProjectColumns，而是有一系列特定的 updateTask 等。
    // 但是 useDnd 的逻辑是重新计算整个 columns 对象并一次性更新。
    // 因此，我们需要在 App (或这里) 适配一下。
    // 最简单的方法是让 useAppData 暴露一个 updateProjectColumns 方法，或者我们在 App.tsx 里构造它。
    // 既然 useDnd 已经在 hook 里了，我们就直接使用它。

    const {
        activeTask,
        dragState,
        autoGroupState, // Exposed from hook
        sensors,
        onDragStart,
        onDragOver,
        onDragEnd
    } = useDnd({ activeProject, updateProjectColumns });

    const wipCount = useMemo(() =>
        countLeaves(activeProject.columns['in-progress'])
        , [activeProject, countLeaves]);

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
                                autoGroupState={autoGroupState} // Pass the state
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};
