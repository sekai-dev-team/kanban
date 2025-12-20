import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Search } from 'lucide-react';
import { Project, Task, ColumnId } from '../../types';
import { Button } from '../ui';

interface MainHeaderProps {
    activeProject: Project | undefined;
    taskCount: number;
    updateProjectDescription: (projectId: string, desc: string) => void;
    isAiOpen: boolean;
    setIsAiOpen: (isOpen: boolean) => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    expandParents: (projectId: string, taskId: string) => void;
    setHighlightedTaskId: (id: string | null) => void;
    updateProjectName: (projectId: string, name: string) => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
    activeProject,
    taskCount,
    updateProjectDescription,
    isAiOpen,
    setIsAiOpen,
    saveStatus,
    expandParents,
    setHighlightedTaskId,
    updateProjectName
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    if (!activeProject) return null;

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            setHighlightedTaskId(null);
            return;
        }

        let query = searchQuery.trim();
        if (query.startsWith('#')) query = query.slice(1);

        // Search Helper
        const search = (tasks: Task[], predicate: (t: Task) => boolean): Task | undefined => {
            for (const t of tasks) {
                if (predicate(t)) return t;
                if (t.children.length > 0) {
                    const found = search(t.children, predicate);
                    if (found) return found;
                }
            }
            return undefined;
        };

        const allTasks = Object.values(activeProject.columns).flat();
        
        // Only Match ID suffix (supports full ID as well since full ID ends with itself)
        const foundTask = search(allTasks, t => t.id.endsWith(query));

        if (foundTask) {
            expandParents(activeProject.id, foundTask.id);
            setHighlightedTaskId(foundTask.id);
        } else {
            setHighlightedTaskId(null);
        }
    };

    const startEditing = () => {
        setTempName(activeProject.name);
        setIsEditingName(true);
    };

    const submitNameEdit = () => {
        if (tempName.trim()) {
            updateProjectName(activeProject.id, tempName.trim());
        }
        setIsEditingName(false);
    };

    return (
        <header className="h-auto min-h-[4rem] border-b border-gray-200 dark:border-zinc-800 flex flex-col justify-center px-8 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md z-10 py-3">
            <div className="flex items-start justify-between">
                <div className="flex-1 mr-8">
                    <div className="flex items-center gap-4 mb-1">
                        {isEditingName ? (
                            <input
                                autoFocus
                                className="text-xl font-semibold text-gray-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none w-auto min-w-[200px]"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={submitNameEdit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitNameEdit();
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                            />
                        ) : (
                            <h2 
                                className="text-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-100/50 dark:hover:bg-zinc-800/50 px-1 -mx-1 rounded cursor-text transition-colors"
                                onDoubleClick={startEditing}
                                title="Double click to rename"
                            >
                                {activeProject.name}
                            </h2>
                        )}
                        
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 font-mono">
                            {taskCount} Top-level Tasks
                        </span>
                    </div>
                    {/* Project Description */}
                    <input
                        className="w-full bg-transparent text-sm text-gray-500 dark:text-gray-400 focus:text-gray-800 dark:focus:text-gray-200 focus:outline-none border-b border-transparent focus:border-gray-200 dark:focus:border-zinc-700 transition-colors pb-0.5"
                        value={activeProject.description || ''}
                        onChange={(e) => updateProjectDescription(activeProject.id, e.target.value)}
                        placeholder="Add a project description..."
                    />
                </div>

                {/* Status Indicator & AI */}
                <div className="flex items-center gap-4">
                    
                    {/* Search Box */}
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="Find by ID..." 
                            className="pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800/50 border border-transparent focus:border-indigo-500 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all w-32 focus:w-48"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>

                    <Button
                        variant="ghost"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20"
                        onClick={() => setIsAiOpen(!isAiOpen)}
                    >
                        <Sparkles size={16} />
                        AI Assist
                    </Button>

                    {saveStatus === 'saving' && <Loader2 size={16} className="animate-spin text-gray-400" />}
                    {saveStatus === 'saved' && <CheckCircle2 size={16} className="text-green-500" />}
                    {saveStatus === 'error' && <AlertCircle size={16} className="text-red-500" title="Sync Error" />}
                </div>
            </div>
        </header>
    );
};
