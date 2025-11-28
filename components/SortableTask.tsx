import React, { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, ChevronRight, ChevronDown, Plus, Copy, Trash, Edit2 } from 'lucide-react';
import { Task, ColumnId } from '../types';
import { Menu, MenuItem } from './ui';

interface Props {
    task: Task;
    depth?: number;
    onUpdate: (taskId: string, updates: Partial<Task>) => void;
    onDelete: (taskId: string) => void;
    onAddChild: (parentId: string, content: string) => void;
    onMoveToColumn: (taskId: string, targetColId: ColumnId) => void;
    onClone: (taskId: string) => void;
}

export const SortableTask: React.FC<Props> = ({
    task,
    depth = 0,
    onUpdate,
    onDelete,
    onAddChild,
    onMoveToColumn,
    onClone
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver,
        over
    } = useSortable({
        id: task.id,
        data: { type: 'Task', task }
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(task.content);
    const [isAddingChild, setIsAddingChild] = useState(false);
    const [newChildContent, setNewChildContent] = useState('');

    const editInputRef = useRef<HTMLInputElement>(null);
    const addChildInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus logic
    useEffect(() => {
        if (isEditing && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isAddingChild && addChildInputRef.current) {
            addChildInputRef.current.focus();
        }
    }, [isAddingChild]);

    // Handlers
    const handleEditSubmit = () => {
        if (editContent.trim()) {
            onUpdate(task.id, { content: editContent });
        } else {
            setEditContent(task.content); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleAddChildSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newChildContent.trim()) {
            onAddChild(task.id, newChildContent);
            setNewChildContent('');
            setTimeout(() => addChildInputRef.current?.focus(), 10);
            if (!task.isExpanded) {
                onUpdate(task.id, { isExpanded: true });
            }
        } else {
            setIsAddingChild(false);
        }
    };

    // DnD Styles
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-40 bg-gray-200 dark:bg-zinc-800 rounded-lg h-12 border-2 border-dashed border-zinc-400 dark:border-zinc-600 mb-2"
            />
        );
    }

    // Determine if we are nesting based on strict center hover
    // dnd-kit doesn't expose relative cursor position easily in render, 
    // but we can infer intention. 
    // If isOver is true, we need to check App.tsx logic, 
    // but here we can add a visual style if `App.tsx` decides it's a nest.
    // However, for simple visual feedback without complex context, 
    // we rely on 'isOver' but usually that triggers for sorting too.
    // We will style slightly differently: if sorting, the placeholder appears nearby.
    // If nesting (directly over), we highlight border.
    // Since we enabled SortableContext for children, 'isOver' might be true 
    // when hovering the container vs the item.

    // Simplified visual: If over and not over a child (bubbling), highlight.
    const isDirectlyOver = isOver && over?.id === task.id;
    const nestHighlight = isDirectlyOver ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 z-10' : '';

    return (
        <div ref={setNodeRef} style={style} className="mb-2 touch-manipulation">
            <div
                className={`group relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${nestHighlight}`}
            >
                <div className="flex items-center p-3 gap-2">
                    {/* Expander */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(task.id, { isExpanded: !task.isExpanded });
                        }}
                        className={`p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 ${task.children.length === 0 ? 'opacity-20 hover:opacity-100' : ''}`}
                    >
                        {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Content / Edit Mode */}
                    <div className="flex-1 min-w-0" {...attributes} {...listeners}>
                        {isEditing ? (
                            <input
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onBlur={handleEditSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSubmit();
                                    if (e.key === 'Escape') {
                                        setEditContent(task.content);
                                        setIsEditing(false);
                                    }
                                }}
                                className="w-full bg-transparent border-b border-blue-500 focus:outline-none text-sm p-0 pb-0.5"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                onDoubleClick={() => setIsEditing(true)}
                                className="block text-sm text-gray-700 dark:text-gray-200 truncate cursor-default select-none"
                            >
                                {task.content}
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <button
                            onClick={() => setIsAddingChild(true)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                            title="Add Subtask"
                        >
                            <Plus size={14} />
                        </button>

                        <Menu trigger={
                            <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer">
                                <MoreVertical size={14} />
                            </button>
                        }>
                            <MenuItem onClick={() => setIsEditing(true)}>
                                <div className="flex items-center gap-2"><Edit2 size={14} /> Edit Text</div>
                            </MenuItem>
                            <MenuItem onClick={() => onClone(task.id)}>
                                <div className="flex items-center gap-2"><Copy size={14} /> Duplicate</div>
                            </MenuItem>
                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                            <div className="px-2 py-1 text-xs text-gray-400 uppercase">Move To</div>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'backlog')}>Backlog</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'todo')}>To Do</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'in-progress')}>In Progress</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'done')}>Done</MenuItem>
                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                            <MenuItem onClick={() => onDelete(task.id)} className="text-red-600 dark:text-red-400">
                                <div className="flex items-center gap-2"><Trash size={14} /> Delete</div>
                            </MenuItem>
                        </Menu>
                    </div>
                </div>
            </div>

            {/* Subtasks - Wrapped in SortableContext for Nested Sorting */}
            {(task.isExpanded || isAddingChild) && (
                <div className="ml-6 border-l border-gray-200 dark:border-zinc-800 pl-2 mt-1 space-y-1">
                    <SortableContext items={task.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {task.children.map((child) => (
                            <SortableTask
                                key={child.id}
                                task={child}
                                depth={depth + 1}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                onMoveToColumn={onMoveToColumn}
                                onClone={onClone}
                            />
                        ))}
                    </SortableContext>

                    {/* Add Child Input */}
                    {isAddingChild && (
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-2 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
                            <input
                                ref={addChildInputRef}
                                value={newChildContent}
                                onChange={(e) => setNewChildContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddChildSubmit();
                                    if (e.key === 'Escape') setIsAddingChild(false);
                                }}
                                onBlur={() => {
                                    if (!newChildContent) setIsAddingChild(false);
                                }}
                                placeholder="Subtask..."
                                className="w-full bg-transparent text-sm focus:outline-none"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};