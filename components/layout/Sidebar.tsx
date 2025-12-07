import React from 'react';
import { 
  Layout, Folder, Trash, Plus, Database, Moon, Sun, Search 
} from 'lucide-react';
import { Project, AppData } from '../../types';
import { Button } from '../ui';
import { exportToYaml } from '../../services/yamlService';

interface SidebarProps {
    data: AppData;
    isSearchOpen: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setIsSearchOpen: (isOpen: boolean) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    setActiveProjectId: (id: string) => void;
    setProjectToDelete: (id: string | null) => void;
    setIsProjectModalOpen: (isOpen: boolean) => void;
    setIsYamlModalOpen: (isOpen: boolean) => void;
    setYamlContent: (content: string) => void;
    toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    data,
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    setIsSearchOpen,
    searchInputRef,
    setActiveProjectId,
    setProjectToDelete,
    setIsProjectModalOpen,
    setIsYamlModalOpen,
    setYamlContent,
    toggleTheme
}) => {
    const activeProject = data.projects.find(p => p.id === data.activeProjectId) || data.projects[0];
    const filteredProjects = (data.projects || []).filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside className={`w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col z-20 shadow-sm transition-all duration-300 ${isSearchOpen ? 'w-72' : ''}`}>
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg flex items-center justify-center">
                        <Layout size={18} strokeWidth={2.5} />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight">ZenBoard</h1>
                </div>
            </div>

            {/* Project Search */}
            <div className="px-4 mb-2">
                <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Search projects (Ctrl+K)" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsSearchOpen(true)}
                        onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                <div className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2">Projects</div>
                {filteredProjects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => {
                            setActiveProjectId(project.id);
                            setSearchQuery('');
                        }}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${project.id === activeProject?.id
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Folder size={16} className={project.id === activeProject?.id ? 'fill-current opacity-20' : ''} />
                            <span className="truncate">{project.name}</span>
                        </div>
                        {data.projects.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setProjectToDelete(project.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-all focus:opacity-100 focus:outline-none"
                            >
                                <Trash size={12} className="pointer-events-none" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-zinc-800 space-y-2">
                <Button variant="ghost" className="w-full flex items-center justify-start gap-2 px-3 py-2.5" onClick={() => setIsProjectModalOpen(true)}>
                    <Plus size={16} />
                    <span>New Project</span>
                </Button>
                <Button variant="ghost" className="w-full flex items-center justify-start gap-2 px-3 py-2.5" onClick={() => {
                    setYamlContent(exportToYaml(data));
                    setIsYamlModalOpen(true);
                }}>
                    <Database size={16} />
                    <span>Data / YAML</span>
                </Button>
                <Button variant="ghost" className="w-full flex items-center justify-start gap-2 px-3 py-2.5" onClick={toggleTheme}>
                    {data.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    <span>{data.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </Button>
            </div>
        </aside>
    );
};
