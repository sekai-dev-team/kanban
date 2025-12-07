import React, { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, ChevronRight, ChevronDown, Plus, Copy, Trash, Edit2 } from 'lucide-react';
import { Task, ColumnId, DragState } from '../types';
import { Menu, MenuItem } from './ui';

// Props 定义
interface Props {
    task: Task;
    depth?: number;
    onUpdate: (taskId: string, updates: Partial<Task>) => void;
    onDelete: (taskId: string) => void;
    onAddChild: (parentId: string, content: string) => void;
    onMoveToColumn: (taskId: string, targetColId: ColumnId) => void;
    onClone: (taskId: string) => void;
    dragState: DragState | null; // 全局拖拽视觉状态
    isOverlay?: boolean; // 新增：是否是拖拽预览层
}

export const SortableTask: React.FC<Props> = ({
    task,
    depth = 0,
    onUpdate,
    onDelete,
    onAddChild,
    onMoveToColumn,
    onClone,
    dragState,
    isOverlay = false
}) => {
    // useSortable Hook (For Draggable Source & List Sort Logic)
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        data: { type: 'Task', task }
    });

    // --- Explicit Drop Zones (Sub-droppables) ---
    // We register these ONLY if it's not the overlay preview
    // This physically divides the card into 3 interaction zones.
    const { setNodeRef: setTopRef } = useDroppable({ id: `${task.id}-top`, disabled: isOverlay });
    const { setNodeRef: setMidRef } = useDroppable({ id: `${task.id}-mid`, disabled: isOverlay });
    const { setNodeRef: setBotRef } = useDroppable({ id: `${task.id}-bot`, disabled: isOverlay });

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(task.content);
    const [isAddingChild, setIsAddingChild] = useState(false);
    const [newChildContent, setNewChildContent] = useState('');

    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const addChildInputRef = useRef<HTMLInputElement>(null);

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

    const handleEditSubmit = () => {
        if (editContent.trim()) {
            onUpdate(task.id, { content: editContent });
        } else {
            setEditContent(task.content);
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

    // --- 样式逻辑 ---
    const style = {
        transition,
        // transform: CSS.Translate.toString(transform), // Disabled auto-transform for indicator-based DnD
    };

    // 2. 视觉指示器逻辑
    const isTarget = dragState?.targetId === task.id;

    // Nest Mode: 蓝色边框高亮
    const nestClass = (isTarget && dragState?.type === 'nest')
        ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 bg-blue-50 dark:bg-blue-900/10'
        : '';

    // Sort Mode: 插入线 (Ghost Line)
    const showTopLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'top';
    const showBottomLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'bottom';

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-40 bg-gray-200 dark:bg-zinc-800 rounded-lg h-12 border-2 border-dashed border-zinc-400 dark:border-zinc-600 mb-2"
            />
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="mb-2 touch-manipulation relative select-none">

            {/* --- Explicit Drop Zone Overlays (Pointer Events None to allow clicking through) --- */}
            {/* dnd-kit calculates collision based on Rects, so pointer-events:none is fine */}
            {!isDragging && !isOverlay && (
                <>
                    {/* Top 20% - Insert Before */}
                    <div ref={setTopRef} className="absolute top-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />

                    {/* Middle 60% - Nest */}
                    <div ref={setMidRef} className="absolute top-[20%] left-0 right-0 h-[60%] z-10 pointer-events-none" />

                    {/* Bottom 20% - Insert After */}
                    <div ref={setBotRef} className="absolute bottom-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />
                </>
            )}

            {/* 排序指示线：顶部 */}
            {showTopLine && (
                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-20 pointer-events-none" />
            )}

            {/* 卡片主体 */}
            <div
                className={`group relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${nestClass}`}
            >
                <div className="flex items-center p-3 gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(task.id, { isExpanded: !task.isExpanded });
                        }}
                        className={`p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 ${task.children.length === 0 ? 'opacity-20 hover:opacity-100' : ''} z-20 relative`}
                    >
                        {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <div className="flex-1 min-w-0 z-20 relative" {...attributes} {...(isEditing ? {} : listeners)}>
                        {isEditing ? (
                            <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onBlur={handleEditSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleEditSubmit();
                                    }
                                    if (e.key === 'Escape') {
                                        setEditContent(task.content);
                                        setIsEditing(false);
                                    }
                                }}
                                className="w-full bg-transparent border border-blue-500 rounded focus:outline-none text-sm p-2 resize-none block"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                rows={3}
                            />
                        ) : (
                            <span
                                onDoubleClick={() => setIsEditing(true)}
                                className="block text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words cursor-default"
                            >
                                {task.content}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20 relative">
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

            {/* 排序指示线：底部 */}
            {showBottomLine && (
                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-20 pointer-events-none" />
            )}

            {/* 子任务渲染 */}
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
                                dragState={dragState}
                            />
                        ))}
                    </SortableContext>

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