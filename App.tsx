import React, { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

// Hooks
import { useAppData } from './hooks/useAppData';
import { useUI } from './hooks/useUI';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { MainHeader } from './components/layout/MainHeader';
import { Board } from './components/layout/Board';
import { AIChat } from './components/AIChat';
// 新增：引入 Dashboard
import { Dashboard } from './components/dashboard/Dashboard';

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
        updateProjectName,
        updateWipLimit,
        updateProjectColumns,
        updateProjectStatus, // 确保这个从 useAppData 导出了
        deleteProject,
        addTask,
        updateTask,
        addChildTask,
        deleteTask,
        moveToColumn,
        moveProject,
        cloneTask,
        setActiveProjectId,
        toggleTheme,
        countLeaves,
        expandParents
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
        searchInputRef,
        highlightedTaskId, 
        setHighlightedTaskId
    } = useUI();

    // 新增：视图状态管理 ('dashboard' | 'board')
    const [view, setView] = useState<'dashboard' | 'board'>('dashboard');

    const activeProject = useMemo(() => 
        data.projects.find(p => p.id === data.activeProjectId)
    , [data.projects, data.activeProjectId]);

    // 交互包装函数：点击项目时，不仅设置 ID，还切换视图
    const handleProjectSelect = (projectId: string) => {
        setActiveProjectId(projectId);
        setView('board');
        // 移动端/小屏下可能需要关闭侧边栏，这里暂时不处理
    };

    // 交互包装函数：回到首页
    const handleGoHome = () => {
        setView('dashboard');
        // 可选：清除 activeProjectId，这样 Sidebar 就不会高亮任何项目
        // setActiveProjectId(''); 
    };

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
            
            {/* Sidebar 始终存在，作为全局导航 */}
            <Sidebar 
                data={data}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setIsSearchOpen={setIsSearchOpen}
                searchInputRef={searchInputRef}
                setActiveProjectId={handleProjectSelect} // 传入包装后的函数
                setProjectToDelete={setProjectToDelete}
                setIsProjectModalOpen={setIsProjectModalOpen}
                setIsYamlModalOpen={setIsYamlModalOpen}
                setYamlContent={setYamlContent}
                toggleTheme={toggleTheme}
                onGoHome={handleGoHome} // 传入回到首页函数
                updateProjectName={updateProjectName}
            />

            {/* Main Area: 根据 view 状态切换显示内容 */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                
                {view === 'dashboard' ? (
                    // --- 视图 A: 仪表盘首页 ---
                    <Dashboard 
                        data={data}
                        onProjectClick={handleProjectSelect}
                        onUpdateProjectStatus={updateProjectStatus}
                        onMoveProject={moveProject} // 2. 传入排序方法
                        onNewProject={() => setIsProjectModalOpen(true)}
                        onUpdateProjectName={updateProjectName}
                    />
                ) : activeProject ? (
                    // --- 视图 B: 项目看板 ---
                    <>
                        <MainHeader 
                            activeProject={activeProject}
                            taskCount={Object.values(activeProject.columns).flat().length}
                            updateProjectDescription={updateProjectDescription}
                            isAiOpen={isAiOpen}
                            setIsAiOpen={setIsAiOpen}
                            saveStatus={saveStatus}
                            expandParents={expandParents}
                            setHighlightedTaskId={setHighlightedTaskId}
                            updateProjectName={updateProjectName}
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
                            highlightedTaskId={highlightedTaskId}
                        />
                    </>
                ) : (
                    // 异常状态：在 board 视图但没有 activeProject (基本不会发生，除非删除了当前项目)
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
                        <p>Project not found.</p>
                        <button onClick={handleGoHome} className="text-blue-500 hover:underline">Return to Dashboard</button>
                    </div>
                )}
            </main>

            {/* Global Components & Modals */}
            {/* AI Chat 仅在看板视图下有意义吗？或者全局可用？这里暂时保持全局加载，但在 Dashboard 可能会遮挡，视需求调整 */}
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
                addProject={(name) => {
                    addProject(name);
                    // 3. 修复 Bug 2: 删除了 setView('board');
                    // 现在创建完项目后，会停留在 Dashboard，你可以看到新项目出现在 active 列表中
                }}
            />

            <DeleteProjectModal 
                projectToDelete={projectToDelete}
                setProjectToDelete={setProjectToDelete}
                deleteProject={(id) => {
                    deleteProject(id);
                    // 如果删除了当前项目，回到首页
                    if (id === data.activeProjectId) {
                        setView('dashboard');
                    }
                }}
            />

        </div>
    );
}