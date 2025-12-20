import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, ArrowRight } from 'lucide-react';
import { Project, ProjectStatus, Task } from '../../types';

interface ProjectCardProps {
    project: Project;
    onClick: (projectId: string) => void;
    onUpdateName: (projectId: string, name: string) => void;
}

const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return 'Today';
    if (hours < 48) return 'Yesterday';
    return date.toLocaleDateString();
};

const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
        case 'active': return 'bg-yellow-500';
        case 'completed': return 'bg-green-500';
        case 'planning': return 'bg-gray-400';
        default: return 'bg-gray-400';
    }
};

const getStatusBorderClass = (status: ProjectStatus) => {
    switch (status) {
        case 'active': return 'border-t-yellow-500';
        case 'completed': return 'border-t-green-500';
        case 'planning': return 'border-t-gray-400';
        default: return 'border-t-gray-400';
    }
};

const countLeaves = (tasks: Task[]): number => {
    let count = 0;
    for (const t of tasks) {
        if (t.children.length === 0) {
            count++;
        } else {
            count += countLeaves(t.children);
        }
    }
    return count;
};

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onUpdateName }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: project.id,
        data: { type: 'Project', project }
    });

    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(project.name);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    const allTasks = Object.values(project.columns).flat();
    const totalCount = countLeaves(allTasks);
    const doneCount = countLeaves(project.columns['done']);
    const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

    const handleEditStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setTempName(project.name);
        setIsEditing(true);
    };

    const handleEditSubmit = () => {
        if (tempName.trim()) {
            onUpdateName(project.id, tempName.trim());
        }
        setIsEditing(false);
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="h-32 rounded-xl bg-gray-100 dark:bg-zinc-800 border-2 border-dashed border-gray-300 dark:border-zinc-700 opacity-50"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(project.id)}
            className={`group relative bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border-t-[3px] ${getStatusBorderClass(project.status)}`}
        >
            <div className="p-5">
                {/* Header: 使用 flex 布局解决重叠问题 */}
                <div className="flex justify-between items-start mb-2">
                    {/* 标题区域：右侧留出 padding 防止撞到图标 */}
                    <div className="pr-8 flex-1">
                        {isEditing ? (
                            <input
                                autoFocus
                                className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={handleEditSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSubmit();
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                            />
                        ) : (
                            <h3 
                                className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight transition-colors truncate hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 rounded px-1 -mx-1 cursor-text"
                                onDoubleClick={handleEditStart}
                                onClick={(e) => e.stopPropagation()}
                                title="Double click to rename"
                            >
                                {project.name}
                            </h3>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1 min-h-[1.25em]">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* 右上角交互区域：状态点 <-> 箭头 切换动画 */}
                    <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                        {/* 状态圆点：悬停时缩小隐藏 */}
                        <div className={`absolute w-2 h-2 rounded-full transition-all duration-300 ease-out group-hover:scale-0 group-hover:opacity-0 ${getStatusColor(project.status)}`} />
                        
                        {/* 箭头：悬停时放大出现 */}
                        <div className="absolute transition-all duration-300 ease-out scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-gray-400 group-hover:text-blue-500">
                            <ArrowRight size={18} />
                        </div>
                    </div>
                </div>

                {/* Metrics / Stats */}
                <div className="mt-4 flex items-end justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Progress
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-semibold text-gray-900 dark:text-white">{progress}%</span>
                            <span className="text-xs text-gray-500 mb-1">
                                ({doneCount}/{totalCount})
                            </span>
                        </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>Updated {formatTime(project.updatedAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${getStatusColor(project.status)}`} 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};