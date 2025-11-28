import React, { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, MoreHorizontal } from 'lucide-react';
import { SortableTask } from './SortableTask';
import { Task, ColumnId } from '../types';
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
    currentWipCount = 0
}) => {
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
        // Loop adding (Step 3)
        // We stay in adding mode
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
    const isAtLimit = wipLimit ? currentWipCount >= wipLimit : false;

    return (
        <div className="flex flex-col h-full min-w-[280px] w-full max-w-[350px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
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

            {/* Droppable Area */}
            <div
                ref={setNodeRef}
                className={`flex-1 bg-gray-50/50 dark:bg-zinc-900/20 rounded-xl p-2 border transition-colors ${isOverLimit ? 'border-red-200 dark:border-red-900/50 bg-red-50/30' : 'border-transparent'
                    }`}
            >
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col min-h-[100px]">
                        {tasks.map((task) => (
                            <SortableTask
                                key={task.id}
                                task={task}
                                onUpdate={onUpdateTask}
                                onDelete={onDeleteTask}
                                onAddChild={onAddChild}
                                onMoveToColumn={onMoveToColumn}
                                onClone={onClone}
                            />
                        ))}
                        {tasks.length === 0 && (
                            <div className="h-24 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                Drop items here
                            </div>
                        )}
                    </div>
                </SortableContext>

                {/* Add Button / Form */}
                <div className="mt-3">
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
                            // Only disable if hard limit enforcing is desired. The prompt implies checking *during drag*, but for manual add it's usually better to allow and show error. 
                            // However, "Add button... check WIP" was not explicitly stated for button, but implied by WIP rules. 
                            // Let's warn visually but allow add, as "Drop" has strict check in prompt.
                            className="w-full py-2 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/50 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            <span>Add Card</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
