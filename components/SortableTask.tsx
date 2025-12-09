import React, { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    MoreVertical, ChevronRight, ChevronDown, Plus, Copy, Trash, Edit2,
    Clock, CheckSquare, Hash, Flag // 新增 Hash (ID) 和 Flag (优先级) 图标
} from 'lucide-react';
import { Task, ColumnId, DragState, Priority } from '../types';
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
    dragState: DragState | null;
    isOverlay?: boolean;
}

const getRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

// 优先级颜色映射辅助函数
const getPriorityColor = (priority?: Priority) => {
    switch (priority) {
        case 'high': return 'bg-red-500';
        case 'medium': return 'bg-orange-400';
        case 'low': return 'bg-blue-400';
        default: return 'bg-transparent';
    }
};

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

    const totalSubtasks = task.children.length;
    const completedSubtasks = task.children.filter(t => t.completed).length;
    const progressPercent = totalSubtasks === 0 ? 0 : Math.round((completedSubtasks / totalSubtasks) * 100);
    const showProgress = totalSubtasks > 0;

    const style = { transition };
    const isTarget = dragState?.targetId === task.id;
    const nestClass = (isTarget && dragState?.type === 'nest')
        ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 bg-blue-50 dark:bg-blue-900/10'
        : '';
    const showTopLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'top';
    const showBottomLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'bottom';

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="opacity-40 bg-gray-200 dark:bg-zinc-800 rounded-lg h-12 border-2 border-dashed border-zinc-400 dark:border-zinc-600 mb-2" />
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="mb-2 touch-manipulation relative select-none">
            {!isDragging && !isOverlay && (
                <>
                    <div ref={setTopRef} className="absolute top-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />
                    <div ref={setMidRef} className="absolute top-[20%] left-0 right-0 h-[60%] z-10 pointer-events-none" />
                    <div ref={setBotRef} className="absolute bottom-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />
                </>
            )}
            {showTopLine && <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-20 pointer-events-none" />}

            <div className={`group relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${nestClass}`}>

                {/* 4. 优先级指示条 (Priority Indicator) - 卡片左侧的彩色竖条 */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${getPriorityColor(task.priority)} z-20`} />

                {/* 进度条背景 */}
                {showProgress && (
                    <div className="absolute bottom-0 left-0 h-1 bg-gray-100 dark:bg-zinc-800 w-full">
                        <div
                            className={`h-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className="flex items-start p-3 gap-2 pl-4"> {/* pl-4 为了避开左侧的优先级条 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(task.id, { isExpanded: !task.isExpanded });
                        }}
                        className={`mt-0.5 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 ${totalSubtasks === 0 ? 'opacity-20 hover:opacity-100' : ''} z-20 relative`}
                    >
                        {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {depth > 0 && (
                        <div className="mt-0.5 z-20 relative" onPointerDown={e => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={!!task.completed}
                                onChange={() => onUpdate(task.id, { completed: !task.completed })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="flex-1 min-w-0 z-20 relative flex flex-col gap-1" {...attributes} {...(isEditing ? {} : listeners)}>
                        {isEditing ? (
                            <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onBlur={handleEditSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                                    if (e.key === 'Escape') { setEditContent(task.content); setIsEditing(false); }
                                }}
                                className="w-full bg-transparent border border-blue-500 rounded focus:outline-none text-sm p-2 resize-none block"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                rows={3}
                            />
                        ) : (
                            <div className="flex flex-col">
                                <span
                                    onDoubleClick={() => setIsEditing(true)}
                                    className={`block text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words cursor-default transition-all ${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}
                                >
                                    {task.content}
                                </span>

                                {showProgress && (
                                    <div className="flex items-center gap-1.5 mt-1.5 w-fit">
                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${progressPercent === 100
                                                ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                                            }`}>
                                            <CheckSquare size={10} />
                                            <span>{completedSubtasks}/{totalSubtasks}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 右侧操作栏 */}
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20 relative self-start">

                        {/* 5. ID 标识 (悬停显示) */}
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 select-none bg-gray-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-zinc-700 whitespace-nowrap" title={`Full ID: ${task.id}`}>
                            <Hash size={10} />
                            <span className="font-mono">{task.id.slice(-4)}</span>
                        </div>

                        {task.createdAt && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 select-none bg-gray-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-zinc-700 whitespace-nowrap">
                                <Clock size={10} />
                                <span>{getRelativeTime(task.createdAt)}</span>
                            </div>
                        )}

                        <button onClick={() => setIsAddingChild(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"><Plus size={14} /></button>

                        <Menu trigger={<button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"><MoreVertical size={14} /></button>}>

                            {/* 4. 优先级设置菜单 */}
                            <div className="px-2 py-1 text-xs text-gray-400 uppercase mt-1">Priority</div>
                            <MenuItem onClick={() => onUpdate(task.id, { priority: 'high' })}>
                                <div className="flex items-center gap-2 text-red-600"><Flag size={14} /> High</div>
                            </MenuItem>
                            <MenuItem onClick={() => onUpdate(task.id, { priority: 'medium' })}>
                                <div className="flex items-center gap-2 text-orange-500"><Flag size={14} /> Medium</div>
                            </MenuItem>
                            <MenuItem onClick={() => onUpdate(task.id, { priority: 'low' })}>
                                <div className="flex items-center gap-2 text-blue-500"><Flag size={14} /> Low</div>
                            </MenuItem>
                            <MenuItem onClick={() => onUpdate(task.id, { priority: undefined })}>
                                <div className="flex items-center gap-2 text-gray-500"><Flag size={14} /> None</div>
                            </MenuItem>

                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                            <MenuItem onClick={() => setIsEditing(true)}><div className="flex items-center gap-2"><Edit2 size={14} /> Edit Text</div></MenuItem>
                            <MenuItem onClick={() => onClone(task.id)}><div className="flex items-center gap-2"><Copy size={14} /> Duplicate</div></MenuItem>

                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                            <div className="px-2 py-1 text-xs text-gray-400 uppercase">Move To</div>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'backlog')}>Backlog</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'todo')}>To Do</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'in-progress')}>In Progress</MenuItem>
                            <MenuItem onClick={() => onMoveToColumn(task.id, 'done')}>Done</MenuItem>

                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                            <MenuItem onClick={() => onDelete(task.id)} className="text-red-600 dark:text-red-400"><div className="flex items-center gap-2"><Trash size={14} /> Delete</div></MenuItem>
                        </Menu>
                    </div>
                </div>
            </div>

            {showBottomLine && <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] z-20 pointer-events-none" />}

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
                            <input ref={addChildInputRef} value={newChildContent} onChange={(e) => setNewChildContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddChildSubmit(); if (e.key === 'Escape') setIsAddingChild(false); }} onBlur={() => { if (!newChildContent) setIsAddingChild(false); }} placeholder="Subtask..." className="w-full bg-transparent text-sm focus:outline-none" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};