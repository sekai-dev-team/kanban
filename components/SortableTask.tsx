import React, { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    MoreHorizontal, ChevronRight, ChevronDown, Plus, Copy, Trash, Edit2,
    CheckSquare, Flag, ArrowUpRight, Link
} from 'lucide-react';
import { Task, ColumnId, DragState, Priority, AutoGroupState } from '../types';
import { Menu, MenuItem } from './ui';

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
    autoGroupState?: AutoGroupState; // New Prop
    getProgress?: (taskId: string) => { completed: number; total: number };
}

const getRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
};

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
    isOverlay = false,
    autoGroupState,
    getProgress
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
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
        if (isEditing && editInputRef.current) editInputRef.current.focus();
    }, [isEditing]);

    useEffect(() => {
        if (isAddingChild && addChildInputRef.current) addChildInputRef.current.focus();
    }, [isAddingChild]);

    const handleEditSubmit = () => {
        if (editContent.trim()) onUpdate(task.id, { content: editContent });
        else setEditContent(task.content);
        setIsEditing(false);
    };

    const handleAddChildSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newChildContent.trim()) {
            onAddChild(task.id, newChildContent);
            setNewChildContent('');
            if (!task.isExpanded) onUpdate(task.id, { isExpanded: true });
        } else {
            setIsAddingChild(false);
        }
    };

    const { completed: completedSubtasks, total: totalSubtasks } = getProgress ? getProgress(task.id) : { completed: 0, total: 0};
    const progressPercent = totalSubtasks === 0 ? 0 : Math.round((completedSubtasks / totalSubtasks) * 100);
    const showProgress = totalSubtasks > 0;

    const style = { transition };
    const isTarget = dragState?.targetId === task.id;

    const showTopLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'top';
    const showBottomLine = isTarget && dragState?.type === 'insert' && dragState?.position === 'bottom';
    const nestClass = (isTarget && dragState?.type === 'nest')
        ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50/50 dark:bg-blue-900/20'
        : '';

    if (isDragging) {
        return <div
            ref={setNodeRef}
            style={style}
            className="opacity-40 bg-gray-200 dark:bg-zinc-800 rounded-lg h-12 border-2 border-dashed border-zinc-400 dark:border-zinc-600"
        />
    }

    return (
        <div ref={setNodeRef} style={style} className="touch-manipulation relative select-none">
            
            {/* Visual Feedback for Auto Grouping (Overlay Only) */}
            {isOverlay && autoGroupState && (
                <div className={`absolute -top-8 left-0 right-0 flex justify-center z-50 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 ${
                        autoGroupState.type === 'group-existing' 
                            ? 'bg-blue-500 text-white' 
                            : autoGroupState.type === 'duplicate'
                                ? 'bg-purple-500 text-white'
                                : 'bg-indigo-500 text-white'
                    }`}>
                        {autoGroupState.type === 'group-existing' ? (
                            <>
                                <Link size={12} className="stroke-[3]" />
                                <span>Linking to Parent</span>
                            </>
                        ) : autoGroupState.type === 'duplicate' ? (
                            <>
                                <Copy size={12} className="stroke-[3]" />
                                <span>Duplicating Task</span>
                            </>
                        ) : (
                            <>
                                <ArrowUpRight size={12} className="stroke-[3]" />
                                <span>Creating Parent Context</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {!isDragging && !isOverlay && (
                <>
                    <div ref={setTopRef} className="absolute top-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />
                    <div ref={setMidRef} className="absolute top-[20%] left-0 right-0 h-[60%] z-10 pointer-events-none" />
                    <div ref={setBotRef} className="absolute bottom-0 left-0 right-0 h-[20%] z-10 pointer-events-none" />
                </>
            )}

            {showTopLine && <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />}

            <div className={`group relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex ${nestClass}`}>

                {/* 底部绝对定位进度条 */}
                {showProgress && (
                    <div className="absolute bottom-0 left-0 h-[2px] bg-gray-100 dark:bg-zinc-800 w-full z-20">
                        <div
                            className={`h-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                {/* 优化点 1：Pill 间距收紧
                    ml-2 (8px) + w-1 (4px) = 12px 占用，比之前的 ~20px 紧凑得多。
                    my-2.5: 上下稍微留白，保持垂直居中感。
                */}
                <div className={`shrink-0 w-1 rounded-full my-2.5 ml-2 transition-colors duration-300 ${getPriorityColor(task.priority)}`} />

                <div className="flex-1 min-w-0 relative flex flex-col">

                    {/* 优化点 2：Content Padding 收紧
                       py-2 pr-2 pl-2: 上下右左都设为 8px (之前是 12px)，让内容更饱满
                    */}
                    <div className="py-2 pr-2 pl-2">
                        <div className="flex items-start gap-1.5"> {/* gap-1.5 (6px) 比 gap-2 更紧凑 */}

                            {/* 优化点 3：对齐修正
                               text-sm 行高通常是 20px。图标 14px。
                               (20 - 14) / 2 = 3px。
                               所以 mt-[3px] 能保证图标绝对垂直居中于第一行文字。
                            */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate(task.id, { isExpanded: !task.isExpanded });
                                }}
                                className={`mt-[3px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors relative z-20 ${totalSubtasks === 0 ? 'invisible pointer-events-none' : ''}`}
                            >
                                {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            <div className="flex-1 min-w-0" {...attributes} {...(isEditing ? {} : listeners)}>
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
                                        className="w-full bg-gray-50 dark:bg-zinc-800 rounded p-1 text-sm focus:outline-none resize-none block leading-5"
                                        onClick={(e) => e.stopPropagation()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        rows={2}
                                    />
                                ) : (
                                    <div
                                        onDoubleClick={() => setIsEditing(true)}
                                        className="text-sm leading-5 text-gray-700 dark:text-gray-200 break-words"
                                    >
                                        {task.content}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 进度胶囊 */}
                        {showProgress && (
                            // 这里 padding-left 稍微调整以对齐文字
                            <div className="mt-1.5 pl-5">
                                <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${progressPercent === 100
                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400'
                                    : 'bg-gray-50 text-gray-500 border-gray-100 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-400'
                                    }`}>
                                    <CheckSquare size={10} />
                                    <span>{completedSubtasks}/{totalSubtasks}</span>
                                </div>
                            </div>
                        )}

                        {/* 悬停展开的操作栏 */}
                        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out">
                            <div className="overflow-hidden">
                                <div className="pt-2 pl-5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                    <div className="flex items-center gap-2 text-[10px] text-gray-300 dark:text-zinc-600 font-mono select-none">
                                        <span>#{task.id.slice(-4)}</span>
                                        {task.createdAt && <span>• {getRelativeTime(task.createdAt)}</span>}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setIsAddingChild(true)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                            <Plus size={14} />
                                        </button>

                                        <Menu trigger={
                                            <button className="p-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        }>
                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Priority</div>
                                            <div className="grid grid-cols-4 gap-1 px-2 mb-2">
                                                <button onClick={() => onUpdate(task.id, { priority: 'high' })} className="h-6 rounded bg-red-100 hover:ring-2 ring-red-500 flex items-center justify-center text-red-600"><Flag size={12} fill="currentColor" /></button>
                                                <button onClick={() => onUpdate(task.id, { priority: 'medium' })} className="h-6 rounded bg-orange-100 hover:ring-2 ring-orange-500 flex items-center justify-center text-orange-600"><Flag size={12} fill="currentColor" /></button>
                                                <button onClick={() => onUpdate(task.id, { priority: 'low' })} className="h-6 rounded bg-blue-100 hover:ring-2 ring-blue-500 flex items-center justify-center text-blue-600"><Flag size={12} fill="currentColor" /></button>
                                                <button onClick={() => onUpdate(task.id, { priority: undefined })} className="h-6 rounded bg-gray-100 hover:ring-2 ring-gray-400 flex items-center justify-center text-gray-400"><Flag size={12} /></button>
                                            </div>
                                            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />
                                            <MenuItem onClick={() => setIsEditing(true)}><div className="flex items-center gap-2"><Edit2 size={14} /> Edit</div></MenuItem>
                                            <MenuItem onClick={() => onClone(task.id)}><div className="flex items-center gap-2"><Copy size={14} /> Duplicate</div></MenuItem>
                                            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />
                                            <div className="px-2 py-1 text-[10px] text-gray-400 uppercase">Move To</div>
                                            <MenuItem onClick={() => onMoveToColumn(task.id, 'backlog')}>Backlog</MenuItem>
                                            <MenuItem onClick={() => onMoveToColumn(task.id, 'todo')}>To Do</MenuItem>
                                            <MenuItem onClick={() => onMoveToColumn(task.id, 'in-progress')}>In Progress</MenuItem>
                                            <MenuItem onClick={() => onMoveToColumn(task.id, 'done')}>Done</MenuItem>
                                            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />
                                            <MenuItem onClick={() => onDelete(task.id)} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <div className="flex items-center gap-2"><Trash size={14} /> Delete</div>
                                            </MenuItem>
                                        </Menu>

                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(task.id);
                                            }} 
                                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="Quick Delete"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showBottomLine && <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-20" />}

            {(task.isExpanded || isAddingChild) && (
                // 优化点 4：子任务缩进收紧
                // ml-6 -> ml-4 (16px)，显著减少层级过深时的“楼梯”效应
                <div className="ml-4 border-l border-gray-200 dark:border-zinc-800 pl-2 mt-1 space-y-1">
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
                                getProgress={getProgress}
                            />
                        ))}
                    </SortableContext>
                    {isAddingChild && (
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-2 shadow-sm animate-in fade-in zoom-in-95 duration-100">
                            <input ref={addChildInputRef} value={newChildContent} onChange={(e) => setNewChildContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddChildSubmit(); if (e.key === 'Escape') setIsAddingChild(false); }} onBlur={() => { if (!newChildContent) setIsAddingChild(false); }} placeholder="Type a subtask..." className="w-full bg-transparent text-sm focus:outline-none placeholder:text-gray-400" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};