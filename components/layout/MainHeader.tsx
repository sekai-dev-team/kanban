import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Project } from '../../types';
import { Button } from '../ui';

interface MainHeaderProps {
    activeProject: Project | undefined;
    taskCount: number;
    updateProjectDescription: (projectId: string, desc: string) => void;
    isAiOpen: boolean;
    setIsAiOpen: (isOpen: boolean) => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export const MainHeader: React.FC<MainHeaderProps> = ({
    activeProject,
    taskCount,
    updateProjectDescription,
    isAiOpen,
    setIsAiOpen,
    saveStatus
}) => {
    if (!activeProject) return null;

    return (
        <header className="h-auto min-h-[4rem] border-b border-gray-200 dark:border-zinc-800 flex flex-col justify-center px-8 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md z-10 py-3">
            <div className="flex items-start justify-between">
                <div className="flex-1 mr-8">
                    <div className="flex items-center gap-4 mb-1">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {activeProject.name}
                        </h2>
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
