import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

// Hooks
import { useAppData } from './hooks/useAppData';
import { useUI } from './hooks/useUI';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { MainHeader } from './components/layout/MainHeader';
import { Board } from './components/layout/Board';
import { AIChat } from './components/AIChat';

// Modals
import { YamlModal } from './components/modals/YamlModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { DeleteProjectModal } from './components/modals/DeleteProjectModal';

export default function App() {
    // 1. Data & Logic Hook
    const {
        data,
        setData,
        isLoading,
        saveStatus,
        addProject,
        updateProjectDescription,
        updateWipLimit,
        updateProjectColumns,
        deleteProject,
        addTask,
        updateTask,
        addChildTask,
        deleteTask,
        moveToColumn,
        cloneTask,
        setActiveProjectId,
        toggleTheme,
        countLeaves
    } = useAppData();

    // 2. UI State Hook
    const {
        isYamlModalOpen, setIsYamlModalOpen,
        isProjectModalOpen, setIsProjectModalOpen,
        isAiOpen, setIsAiOpen,
        isSearchOpen, setIsSearchOpen,
        projectToDelete, setProjectToDelete,
        newProjectName, setNewProjectName,
        yamlContent, setYamlContent,
        searchQuery, setSearchQuery,
        searchInputRef
    } = useUI();

    const activeProject = useMemo(() => 
        data.projects.find(p => p.id === data.activeProjectId) || data.projects[0]
    , [data.projects, data.activeProjectId]);

    // --- Loading Screen ---
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-indigo-500" />
                    <p className="text-sm font-medium text-gray-500">Syncing with server...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-gray-100 font-sans overflow-hidden">
            
            {/* Sidebar */}
            <Sidebar 
                data={data}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setIsSearchOpen={setIsSearchOpen}
                searchInputRef={searchInputRef}
                setActiveProjectId={setActiveProjectId}
                setProjectToDelete={setProjectToDelete}
                setIsProjectModalOpen={setIsProjectModalOpen}
                setIsYamlModalOpen={setIsYamlModalOpen}
                setYamlContent={setYamlContent}
                toggleTheme={toggleTheme}
            />

            {/* Main Board Area */}
            {activeProject ? (
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    <MainHeader 
                        activeProject={activeProject}
                        taskCount={Object.values(activeProject.columns).flat().length}
                        updateProjectDescription={updateProjectDescription}
                        isAiOpen={isAiOpen}
                        setIsAiOpen={setIsAiOpen}
                        saveStatus={saveStatus}
                    />

                    <Board 
                        activeProject={activeProject}
                        updateProjectColumns={updateProjectColumns}
                        addTask={addTask}
                        updateTask={updateTask}
                        deleteTask={deleteTask}
                        addChildTask={addChildTask}
                        moveToColumn={moveToColumn}
                        cloneTask={cloneTask}
                        updateWipLimit={updateWipLimit}
                        countLeaves={countLeaves}
                    />
                </main>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    No Project Selected
                </div>
            )}

            {/* Global Components & Modals */}
            <AIChat 
                isOpen={isAiOpen} 
                onClose={() => setIsAiOpen(false)}
                data={data}
                onUpdateData={setData}
            />

            <YamlModal 
                isOpen={isYamlModalOpen}
                onClose={() => setIsYamlModalOpen(false)}
                yamlContent={yamlContent}
                setYamlContent={setYamlContent}
                data={data}
                setData={setData}
            />

            <NewProjectModal 
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                newProjectName={newProjectName}
                setNewProjectName={setNewProjectName}
                addProject={addProject}
            />

            <DeleteProjectModal 
                projectToDelete={projectToDelete}
                setProjectToDelete={setProjectToDelete}
                deleteProject={deleteProject}
            />

        </div>
    );
}
