import React from 'react';
import { 
    DndContext, 
    DragOverlay, 
    useDroppable, 
    DragEndEvent,
    DragStartEvent,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react'; // 移除了 LayoutGrid 引用，因为它暂时没用到
import { AppData, Project, ProjectStatus } from '../../types';
import { ProjectCard } from './ProjectCard';

interface DashboardProps {
    data: AppData;
    onProjectClick: (projectId: string) => void;
    onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
    onMoveProject: (activeId: string, overId: string) => void;
    onNewProject: () => void;
    onUpdateProjectName: (projectId: string, name: string) => void;
}

const COLUMNS: { id: ProjectStatus; label: string }[] = [
    { id: 'planning', label: 'Planning' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' }
];

const DashboardColumn = ({ id, label, projects, onProjectClick, onUpdateProjectName }: { 
    id: ProjectStatus, 
    label: string, 
    projects: Project[],
    onProjectClick: (id: string) => void,
    onUpdateProjectName: (projectId: string, name: string) => void
}) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex-1 flex flex-col min-w-[300px] h-full overflow-hidden">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs text-gray-500 font-medium">
                        {projects.length}
                    </span>
                </div>
            </div>

            {/* Droppable Area */}
            <div 
                ref={setNodeRef} 
                className="flex-1 rounded-xl bg-gray-50/50 dark:bg-zinc-900/20 p-4 border border-transparent transition-colors hover:border-gray-200 dark:hover:border-zinc-800/50 overflow-y-auto custom-scrollbar"
            >               
                <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-4">
                        {projects.map(project => (
                            <ProjectCard 
                                key={project.id} 
                                project={project} 
                                onClick={onProjectClick}
                                onUpdateName={onUpdateProjectName}
                            />
                        ))}
                        {projects.length === 0 && (
                            <div className="h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex items-center justify-center text-gray-400 text-xs">
                                No projects
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    data, 
    onProjectClick, 
    onUpdateProjectStatus,
    onMoveProject,
    onNewProject,
    onUpdateProjectName
}) => {
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const projectsByStatus = {
        planning: data.projects.filter(p => p.status === 'planning'),
        active: data.projects.filter(p => p.status === 'active'),
        completed: data.projects.filter(p => p.status === 'completed')
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const projectId = active.id as string;
        const overId = over.id as string;
        
        // 避免自己拖自己
        if (projectId === overId) return;

        // 情况 A: 拖到了列的空白处 (只改变状态)
        if (['planning', 'active', 'completed'].includes(overId)) {
            const currentProject = data.projects.find(p => p.id === projectId);
            if (currentProject && currentProject.status !== overId) {
                onUpdateProjectStatus(projectId, overId as ProjectStatus);
            }
            return;
        }

        // 情况 B: 拖到了另一个卡片上 (可能排序，也可能改变状态)
        const activeProject = data.projects.find(p => p.id === projectId);
        const overProject = data.projects.find(p => p.id === overId);

        if (activeProject && overProject) {
            // 1. 如果状态相同 -> 执行排序
            if (activeProject.status === overProject.status) {
                onMoveProject(projectId, overId);
            } 
            // 2. 如果状态不同 -> 执行移动状态
            else {
                onUpdateProjectStatus(projectId, overProject.status);
            }
        }
    };

    const activeProject = data.projects.find(p => p.id === activeId);

    return (
        <div className="flex-1 h-full flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
            <header className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Overview of all your projects</p>
                </div>
                <button 
                    onClick={onNewProject}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus size={18} />
                    <span>New Project</span>
                </button>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-8">
                <DndContext 
                    sensors={sensors} 
                    onDragStart={handleDragStart} 
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex h-full gap-8 min-w-[1000px]">
                        {COLUMNS.map(col => (
                            <DashboardColumn
                                key={col.id}
                                id={col.id}
                                label={col.label}
                                projects={projectsByStatus[col.id]}
                                onProjectClick={onProjectClick}
                                onUpdateProjectName={onUpdateProjectName}
                            />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeProject ? (
                            // 修复：增加了宽度 w-[340px] (之前是300)，并增加了阴影，让拖拽感更扎实
                            <div className="opacity-90 rotate-2 cursor-grabbing w-[340px]">
                                <ProjectCard 
                                    project={activeProject} 
                                    onClick={() => {}}
                                    onUpdateName={() => {}} // Overlay不需要真正的更新
                                />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
};