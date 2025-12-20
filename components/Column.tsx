import React, { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, MoreHorizontal } from 'lucide-react';
import { SortableTask } from './SortableTask';
import { Task, ColumnId, DragState } from '../types';
import { Button, Input } from './ui';

interface Props {
    id: ColumnId;
    title: string;
    tasks: Task[];
    onAddTask: (content: string) => void;
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    onDeleteTask: (taskId: string) => void;
    onAddChild: (parentId: string, content: string) => void;
    onMoveToColumn: (taskId: string, targetColId: ColumnId) => void;
    onClone: (taskId: string) => void;
    wipLimit?: number;
    onUpdateWipLimit?: (limit: number) => void;
    currentWipCount?: number;
    dragState: DragState | null;
    getProgress: (taskId: string) => { completed: number; total: number };
    highlightedTaskId?: string | null;
}

export const Column: React.FC<Props> = ({
    id,
    title,
    tasks,
    onAddTask,
    onUpdateTask,
    onDeleteTask,
    onAddChild,
    onMoveToColumn,
    onClone,
    wipLimit,
    onUpdateWipLimit,
    currentWipCount = 0,
    dragState,
    getProgress,
    highlightedTaskId
}) => {
    // Use Droppable for the entire column area
    const { setNodeRef } = useDroppable({
        id: id,
        data: { type: 'Column', id }
    });

    const [isAdding, setIsAdding] = useState(false);
    const [newTaskContent, setNewTaskContent] = useState('');
    const [isEditingWip, setIsEditingWip] = useState(false);
    const [wipInput, setWipInput] = useState(wipLimit?.toString() || '0');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskContent.trim()) return;
        onAddTask(newTaskContent);
        setNewTaskContent('');
        const input = document.getElementById(`new-task-input-${id}`);
        input?.focus();
    };

    const handleWipSubmit = () => {
        if (onUpdateWipLimit) {
            const val = parseInt(wipInput);
            if (!isNaN(val) && val >= 0) {
                onUpdateWipLimit(val);
            }
        }
        setIsEditingWip(false);
    };

    const isOverLimit = wipLimit ? currentWipCount > wipLimit : false;

    // Visual Indicators for Column Level Insert
    const showTopLine = dragState?.targetId === id && dragState?.type === 'insert' && dragState?.position === 'top';
    const showBottomLine = dragState?.targetId === id && dragState?.type === 'insert' && dragState?.position === 'bottom';

    return (
        <div
            ref={setNodeRef}
            className="flex flex-col h-full flex-1 min-w-[260px] relative"
        >
            {/* Visual Indicator: Insert at Top */}
            {showTopLine && (
                <div className="absolute top-8 left-2 right-2 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
            )}

            <div className="flex items-center justify-between mb-4 px-1 z-10">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                        {title}
                    </h2>

                    {wipLimit !== undefined ? (
                        isEditingWip ? (
                            <input
                                autoFocus
                                type="number"
                                value={wipInput}
                                onChange={(e) => setWipInput(e.target.value)}
                                onBlur={handleWipSubmit}
                                onKeyDown={(e) => e.key === 'Enter' && handleWipSubmit()}
                                className="w-12 px-1 text-xs border rounded bg-white dark:bg-zinc-800"
                            />
                        ) : (
                            <span
                                onClick={() => {
                                    setWipInput(wipLimit.toString());
                                    setIsEditingWip(true);
                                }}
                                className={`cursor-pointer px-2 py-0.5 rounded-full text-xs font-medium border ${isOverLimit
                                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900'
                                    : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-zinc-800 dark:border-zinc-700'
                                    }`}
                            >
                                {currentWipCount} / {wipLimit}
                            </span>
                        )
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {tasks.length}
                        </span>
                    )}
                </div>
            </div>

            <div
                className={`bg-gray-50/50 dark:bg-zinc-900/20 rounded-xl p-2 border transition-colors relative flex flex-col ${isOverLimit ? 'border-red-200 dark:border-red-900/50 bg-red-50/30' : 'border-transparent'
                    }`}
            >
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {/* 这里加 overflow-y-auto 让任务列表可以独立滚动 */}
                    <div className="flex flex-col min-h-[50px] overflow-y-auto flex-1 pr-1 custom-scrollbar gap-3">
                        {tasks.map((task) => (
                            <SortableTask
                                key={task.id}
                                task={task}
                                onUpdate={onUpdateTask}
                                onDelete={onDeleteTask}
                                onAddChild={onAddChild}
                                onMoveToColumn={onMoveToColumn}
                                onClone={onClone}
                                dragState={dragState}
                                getProgress={getProgress}
                                highlightedTaskId={highlightedTaskId}
                            />
                        ))}
                        {tasks.length === 0 && (
                            <div className="h-24 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                Drop items here
                            </div>
                        )}
                    </div>
                </SortableContext>

                <div className="mt-3 relative z-10">
                    {isAdding ? (
                        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm animate-in fade-in zoom-in duration-200">
                            <Input
                                id={`new-task-input-${id}`}
                                autoFocus
                                placeholder="What needs to be done?"
                                value={newTaskContent}
                                onChange={(e) => setNewTaskContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Escape' && setIsAdding(false)}
                                className="mb-2"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    disabled={!newTaskContent.trim()}
                                    className="px-2 py-1 text-xs"
                                >
                                    Add
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            <span>Add Card</span>
                        </button>
                    )}
                </div>

                {/* Visual Indicator: Insert at Bottom */}
                {showBottomLine && (
                    <div className="absolute bottom-2 left-2 right-2 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-30 pointer-events-none" />
                )}
            </div>
        </div>
    );
};