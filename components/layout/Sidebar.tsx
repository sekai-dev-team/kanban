import React, { useState } from 'react';
import { 
  Layout, Folder, Trash, Plus, Database, Moon, Sun, Search 
} from 'lucide-react';
import { AppData } from '../../types';
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
    // 新增：回到首页的回调
    onGoHome: () => void;
    updateProjectName: (projectId: string, name: string) => void;
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
    toggleTheme,
    onGoHome, // 解构新增属性
    updateProjectName
}) => {
    const activeProject = data.projects.find(p => p.id === data.activeProjectId);
    const filteredProjects = (data.projects || []).filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    const startEditing = (e: React.MouseEvent, projectId: string, currentName: string) => {
        e.stopPropagation();
        setEditingProjectId(projectId);
        setTempName(currentName);
    };

    const handleEditSubmit = (projectId: string) => {
        if (tempName.trim()) {
            updateProjectName(projectId, tempName.trim());
        }
        setEditingProjectId(null);
    };

    return (
        <aside className={`w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col z-20 shadow-sm transition-all duration-300 ${isSearchOpen ? 'w-72' : ''}`}>
            {/* Logo Area - Made Clickable */}
            <div 
                className="p-6 flex items-center justify-between cursor-pointer group"
                onClick={onGoHome}
                title="Go to Dashboard"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Layout size={18} strokeWidth={2.5} />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        SekaiBoard
                    </h1>
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

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
                <div className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2">Projects</div>
                {filteredProjects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => {
                            setActiveProjectId(project.id);
                            setSearchQuery('');
                        }}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                            // 只有当存在 activeProject 且 ID 匹配时才高亮
                            activeProject?.id === project.id
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            <Folder size={16} className={`shrink-0 ${activeProject?.id === project.id ? 'fill-current opacity-20' : ''}`} />
                            {editingProjectId === project.id ? (
                                <input
                                    autoFocus
                                    className="bg-transparent border-b border-indigo-500 outline-none w-full text-sm py-0 min-w-0"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => handleEditSubmit(project.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditSubmit(project.id);
                                        if (e.key === 'Escape') setEditingProjectId(null);
                                    }}
                                />
                            ) : (
                                <span 
                                    className="truncate hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 px-1 -mx-1 rounded cursor-text" 
                                    title="Double click to rename"
                                    onClick={(e) => e.stopPropagation()} // 防止单击跳转
                                    onDoubleClick={(e) => startEditing(e, project.id, project.name)}
                                >
                                    {project.name}
                                </span>
                            )}
                        </div>
                        {/* 删除按钮逻辑保持不变 */}
                        {editingProjectId !== project.id && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setProjectToDelete(project.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-all focus:opacity-100 focus:outline-none ml-2"
                            >
                                <Trash size={12} className="pointer-events-none" />
                            </button>
                        )}
                    </div>
                ))}
                
                {filteredProjects.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                        No projects found
                    </div>
                )}
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