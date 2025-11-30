import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    defaultDropAnimationSideEffects,
    DropAnimation,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
    Plus, Layout, Moon, Sun, Database, CheckCircle2, Folder, Trash,
    Loader2, AlertCircle, Download, Search, Sparkles
} from 'lucide-react';
import { nanoid } from 'nanoid';

// Local Imports
import { Project, Task, COLUMNS, AppData, ColumnId } from './types';
// [Change 1] 引入 loadFromServer，移除 loadFromStorage (或保留作为备用，但此处主要逻辑不再使用)
import { exportToYaml, parseYaml, saveToServer, loadFromServer, downloadYaml } from './services/yamlService';
import { Column } from './components/Column';
import { SortableTask } from './components/SortableTask';
import { Modal, Button, Input, TextArea } from './components/ui';
import { AIChat } from './components/AIChat';

const STORAGE_KEY = "kanban-data";
// Helper to find task in recursive tree
const findTask = (tasks: Task[], id: string): Task | undefined => {
    for (const task of tasks) {
        if (task.id === id) return task;
        if (task.children.length > 0) {
            const found = findTask(task.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

// Helper to remove task from tree
const removeTask = (tasks: Task[], id: string): Task[] => {
    return tasks.filter(t => t.id !== id).map(t => ({
        ...t,
        children: removeTask(t.children, id)
    }));
};

// Helper to count leaves (for WIP)
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

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: { opacity: '0.5' },
        },
    }),
};

// Default empty state to prevent crashes before load
const INITIAL_DATA: AppData = {
    projects: [],
    activeProjectId: '',
    theme: 'light',
    // 根据 types.ts 可能还有其他字段，保持最小结构
};

export default function App() {
    // [Change 2] State Initialization
    // 不再直接从 storage 读取，而是给一个初始空状态，等待 useEffect 加载
    const [data, setData] = useState<AppData>(INITIAL_DATA);
    const [isLoading, setIsLoading] = useState(true); // 新增 Loading 状态

    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // UI State
    const [isYamlModalOpen, setIsYamlModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [yamlContent, setYamlContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isFirstLoad = useRef(true); // 防止首次加载触发保存

    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Derived State
    const activeProject = useMemo(() =>
        data.projects.find(p => p.id === data.activeProjectId) || data.projects[0]
        , [data.projects, data.activeProjectId]);

    const filteredProjects = (data.projects || []).filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const wipCount = useMemo(() =>
        activeProject ? countLeaves(activeProject.columns['in-progress']) : 0
        , [activeProject]);

    // [Change 3] Load Data Effect
    useEffect(() => {
        const initData = async () => {
            try {
                // 假设 loadFromServer 内部处理了 fetch 逻辑，并返回 AppData 对象
                // 这里可能需要传入 project_id，或者你的 loadFromServer 默认获取 'default'
                // 基于 main.py，如果你只有一个全局看板，可能在 yamlService 里写死了 ID
                const serverData = await loadFromServer(STORAGE_KEY) as unknown as AppData;

                // 如果服务器有数据且有项目，就用服务器的。
                // 否则，就使用空状态 (DEFAULT_DATA)，不自动创建 Demo Project。
                if (serverData && serverData.projects && serverData.projects.length > 0) {
                    setData(serverData);
                    if (serverData.theme === 'dark') document.documentElement.classList.add('dark');
                } else {
                    // 显式设置为空状态
                    setData({
                        projects: [],
                        activeProjectId: '',
                        theme: 'light',
                        _version: 1
                    });
                }
            } catch (error) {
                console.error("Failed to load data from server:", error);
                setSaveStatus('error');
            } finally {
                setIsLoading(false);
            }
        };

        initData();
    }, []);

    // [Change 4] Save Data Effect
    useEffect(() => {
        // 如果正在加载中，或者是刚加载完的那一次渲染，不要执行保存
        if (isLoading) return;

        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        // [Removed] saveToStorage(data); // 移除 LocalStorage 同步

        if (data.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        setSaveStatus('saving');
        const timer = setTimeout(async () => {
            try {
                // 调用后端 API 保存
                await saveToServer(STORAGE_KEY, data);
                setSaveStatus('saved');
            } catch (error) {
                console.error("Save error:", error);
                setSaveStatus('error');
                // TODO: Handle 409 Conflict here in next step
            }
        }, 1000); // Debounce 1s

        return () => clearTimeout(timer);
    }, [data, isLoading]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    // --- Handlers: Project ---

    const addProject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        const newProject: Project = {
            id: nanoid(),
            name: newProjectName,
            description: '',
            wipLimit: 3,
            columns: { backlog: [], todo: [], 'in-progress': [], done: [] }
        };
        setData(prev => ({
            ...prev,
            projects: [...prev.projects, newProject],
            activeProjectId: newProject.id
        }));
        setNewProjectName('');
        setIsProjectModalOpen(false);
    };

    const updateProjectDescription = (desc: string) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === activeProject.id ? { ...p, description: desc } : p)
        }));
    };

    const updateWipLimit = (limit: number) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === activeProject.id ? { ...p, wipLimit: limit } : p)
        }));
    };

    const deleteProject = () => {
        if (!projectToDelete) return;
        setData(prev => {
            const remaining = prev.projects.filter(p => p.id !== projectToDelete);
            if (remaining.length === 0) return prev;
            return {
                ...prev,
                projects: remaining,
                activeProjectId: prev.activeProjectId === projectToDelete ? remaining[0].id : prev.activeProjectId
            };
        });
        setProjectToDelete(null);
    };

    // --- Handlers: Tasks ---

    const addTask = (columnId: ColumnId, content: string) => {
        const newTask: Task = { id: nanoid(), content, createdAt: Date.now(), children: [] };
        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;
                return {
                    ...p,
                    columns: {
                        ...p.columns,
                        [columnId]: [...p.columns[columnId], newTask]
                    }
                };
            });
            return { ...prev, projects: projs };
        });
    };

    const updateTask = (taskId: string, updates: Partial<Task>) => {
        const updateRecursive = (tasks: Task[]): Task[] => {
            return tasks.map(t => {
                if (t.id === taskId) return { ...t, ...updates };
                return { ...t, children: updateRecursive(t.children) };
            });
        };
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = updateRecursive(newCols[k]);
                });
                return { ...p, columns: newCols };
            })
        }));
    };

    const addChildTask = (parentId: string, content: string) => {
        const newChild: Task = { id: nanoid(), content, createdAt: Date.now(), children: [] };
        const addRecursive = (tasks: Task[]): Task[] => {
            return tasks.map(t => {
                if (t.id === parentId) return { ...t, children: [...t.children, newChild], isExpanded: true };
                return { ...t, children: addRecursive(t.children) };
            });
        };
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = addRecursive(newCols[k]);
                });
                return { ...p, columns: newCols };
            })
        }));
    };

    const deleteTask = (taskId: string) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = removeTask(newCols[k], taskId);
                });
                return { ...p, columns: newCols };
            })
        }));
    };

    const moveToColumn = (taskId: string, targetColId: ColumnId) => {
        let taskToMove: Task | undefined;

        // 1. Find and Remove
        const removeRecursive = (tasks: Task[]): Task[] => {
            const filtered = [];
            for (const t of tasks) {
                if (t.id === taskId) {
                    taskToMove = t;
                } else {
                    filtered.push({ ...t, children: removeRecursive(t.children) });
                }
            }
            return filtered;
        };

        // 2. Add to Target
        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;

                // Check WIP
                const tempCols = { ...p.columns };
                let foundTask: Task | undefined;
                (Object.keys(tempCols) as ColumnId[]).forEach(k => {
                    const find = findTask(tempCols[k], taskId);
                    if (find) foundTask = find;
                });

                if (targetColId === 'in-progress' && foundTask) {
                    const currentLeaves = countLeaves(tempCols['in-progress']);
                    const incomingLeaves = foundTask.children.length === 0 ? 1 : countLeaves(foundTask.children);
                    if (currentLeaves + incomingLeaves > p.wipLimit) {
                        alert(`WIP Limit Reached! Cannot move task to In Progress. Limit: ${p.wipLimit}`);
                        return p;
                    }
                }

                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = removeRecursive(newCols[k]);
                });

                if (taskToMove) {
                    newCols[targetColId] = [...newCols[targetColId], taskToMove];
                }
                return { ...p, columns: newCols };
            });
            return { ...prev, projects: projs };
        });
    };

    const cloneTask = (taskId: string) => {
        const deepClone = (t: Task): Task => ({
            ...t,
            id: nanoid(),
            content: `${t.content} (Copy)`,
            children: t.children.map(deepClone)
        });

        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;
                const newCols = { ...p.columns };
                let foundClone: Task | undefined;

                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    const t = findTask(newCols[k], taskId);
                    if (t) foundClone = deepClone(t);
                });

                if (foundClone) {
                    (Object.keys(newCols) as ColumnId[]).forEach(k => {
                        if (findTask(newCols[k], taskId)) {
                            newCols[k] = [...newCols[k], foundClone!];
                        }
                    });
                }
                return { ...p, columns: newCols };
            });
            return { ...prev, projects: projs };
        });
    };

    // --- DnD Handlers ---

    const onDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        let task: Task | undefined;
        (Object.keys(activeProject.columns) as ColumnId[]).forEach(k => {
            const found = findTask(activeProject.columns[k], active.id as string);
            if (found) task = found;
        });
        setActiveTask(task || null);
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveTask(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== activeProject.id) return p;

                const newCols = { ...p.columns };
                let taskObj: Task | undefined;

                // Is this a clone operation?
                const isClone = (event.activatorEvent as any)?.ctrlKey;

                // Helper to remove task and grab it
                const removeAndGet = (list: Task[]): Task[] => {
                    const res: Task[] = [];
                    for (const t of list) {
                        if (t.id === activeId) {
                            taskObj = isClone ? { ...t, id: nanoid(), children: [] } : t;
                            if (isClone) res.push(t);
                        } else {
                            res.push({ ...t, children: removeAndGet(t.children) });
                        }
                    }
                    return res;
                };

                // 1. Remove Source Task
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = removeAndGet(newCols[k]);
                });

                // If we failed to find the task (shouldn't happen), abort to prevent data loss
                if (!taskObj) return p;

                // 2. Identify Target
                const isOverColumn = Object.keys(newCols).includes(overId);

                if (isOverColumn) {
                    // Case A: Drop on Column
                    const targetColId = overId as ColumnId;

                    // Check WIP
                    if (targetColId === 'in-progress') {
                        const leaves = countLeaves(newCols['in-progress']);
                        const taskLeaves = taskObj.children.length === 0 ? 1 : countLeaves(taskObj.children);
                        if (leaves + taskLeaves > p.wipLimit) return p;
                    }

                    newCols[targetColId].push(taskObj);
                } else {
                    // Case B: Drop on another Task
                    // Find where the 'over' task is in the tree
                    let targetLocation: { list: Task[], index: number, parent?: Task } | null = null;
                    let targetColId: ColumnId | undefined;

                    const findInTree = (list: Task[], colId: ColumnId): { list: Task[], index: number, parent?: Task } | null => {
                        const idx = list.findIndex(t => t.id === overId);
                        if (idx !== -1) return { list, index: idx };

                        for (const t of list) {
                            const res = findInTree(t.children, colId);
                            if (res) return { ...res, parent: t };
                        }
                        return null;
                    };

                    (Object.keys(newCols) as ColumnId[]).forEach(k => {
                        const res = findInTree(newCols[k], k);
                        if (res) {
                            targetLocation = res;
                            targetColId = k;
                        }
                    });

                    if (targetLocation && targetColId) {
                        const { list, index, parent } = targetLocation;
                        const targetTask = list[index];

                        // Check WIP
                        if (targetColId === 'in-progress') {
                            const leaves = countLeaves(newCols['in-progress']);
                            const taskLeaves = taskObj.children.length === 0 ? 1 : countLeaves(taskObj.children);
                            if (leaves + taskLeaves > p.wipLimit) return p;
                        }

                        // Decision: Nest or Reorder?
                        // We check vertical position relative to the target rect.
                        const activeRect = active.rect.current.translated;
                        const overRect = over.rect; // dnd-kit rect for the over element

                        let action: 'before' | 'after' | 'nest' = 'after';

                        if (activeRect && overRect) {
                            const overTop = overRect.top;
                            const overHeight = overRect.height;
                            const activeCenter = activeRect.top + (activeRect.height / 2);

                            // Thresholds: Top 25% -> Before, Bottom 25% -> After, Middle 50% -> Nest
                            const topThreshold = overTop + (overHeight * 0.25);
                            const bottomThreshold = overTop + (overHeight * 0.75);

                            if (activeCenter < topThreshold) {
                                action = 'before';
                            } else if (activeCenter > bottomThreshold) {
                                action = 'after';
                            } else {
                                // Middle zone
                                action = 'nest';
                            }
                        }

                        // Special case: Cannot nest clone easily if we want to keep it simple, but requirement says "drag to center to child".
                        // If action is nest, push to children.
                        if (action === 'nest' && !isClone) {
                            targetTask.children.push(taskObj);
                            targetTask.isExpanded = true;
                        } else {
                            // Reorder
                            // If 'before', insert at index.
                            // If 'after', insert at index + 1.
                            const insertIndex = action === 'before' ? index : index + 1;
                            list.splice(insertIndex, 0, taskObj);
                        }
                    } else {
                        // Fallback: If we hovered over something but couldn't find it in tree (rare race condition),
                        // put it back in source (or first col). 
                        // Best effort: Add to Backlog.
                        newCols['backlog'].push(taskObj);
                    }
                }

                return { ...p, columns: newCols };
            });
            return { ...prev, projects: projs };
        });
    };


    return (
        <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-gray-100 font-sans overflow-hidden">

            {/* Sidebar */}
            <aside className={`w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col z-20 shadow-sm transition-all duration-300 ${isSearchOpen ? 'w-72' : ''}`}>
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg flex items-center justify-center">
                            <Layout size={18} strokeWidth={2.5} />
                        </div>
                        <h1 className="font-bold text-lg tracking-tight">Sekai Board</h1>
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
                                setData(p => ({ ...p, activeProjectId: project.id }));
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
                    <Button variant="ghost" className="w-full flex items-center justify-start gap-2 px-3 py-2.5" onClick={() => setData(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}>
                        {data.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                        <span>{data.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                    </Button>
                </div>
            </aside>

            {/* Main Board Area */}
            {activeProject ? (
                <main className="flex-1 flex flex-col overflow-hidden relative">
                    <header className="h-auto min-h-[4rem] border-b border-gray-200 dark:border-zinc-800 flex flex-col justify-center px-8 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md z-10 py-3">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 mr-8">
                                <div className="flex items-center gap-4 mb-1">
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        {activeProject.name}
                                    </h2>
                                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 font-mono">
                                        {Object.values(activeProject.columns).flat().length} Top-level Tasks
                                    </span>
                                </div>
                                {/* Project Description */}
                                <input
                                    className="w-full bg-transparent text-sm text-gray-500 dark:text-gray-400 focus:text-gray-800 dark:focus:text-gray-200 focus:outline-none border-b border-transparent focus:border-gray-200 dark:focus:border-zinc-700 transition-colors pb-0.5"
                                    value={activeProject.description || ''}
                                    onChange={(e) => updateProjectDescription(e.target.value)}
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

                    <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={onDragStart}
                            onDragOver={() => { }} // Handle over in DragEnd for logic simplicity with trees
                            onDragEnd={onDragEnd}
                            dropAnimation={dropAnimation}
                        >
                            <div className="flex h-full gap-6 min-w-max pb-4">
                                {COLUMNS.map(col => (
                                    <Column
                                        key={col.id}
                                        id={col.id}
                                        title={col.label}
                                        tasks={activeProject.columns[col.id]}
                                        onAddTask={(content) => addTask(col.id, content)}
                                        onUpdateTask={updateTask}
                                        onDeleteTask={deleteTask}
                                        onAddChild={addChildTask}
                                        onMoveToColumn={moveToColumn}
                                        onClone={cloneTask}
                                        wipLimit={col.id === 'in-progress' ? activeProject.wipLimit : undefined}
                                        onUpdateWipLimit={col.id === 'in-progress' ? updateWipLimit : undefined}
                                        currentWipCount={col.id === 'in-progress' ? wipCount : undefined}
                                    />
                                ))}
                            </div>
                            <DragOverlay>
                                {activeTask ? (
                                    <div className="opacity-90 rotate-2 cursor-grabbing">
                                        <SortableTask
                                            task={activeTask}
                                            onDelete={() => { }}
                                            onUpdate={() => { }}
                                            onAddChild={() => { }}
                                            onMoveToColumn={() => { }}
                                            onClone={() => { }}
                                        />
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </main>
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    No Project Selected
                </div>
            )}

            {/* AI Chat */}
            <AIChat
                isOpen={isAiOpen}
                onClose={() => setIsAiOpen(false)}
                data={data}
                onUpdateData={(newData) => setData(newData)}
            />

            {/* Modals */}
            <Modal
                isOpen={isYamlModalOpen}
                onClose={() => setIsYamlModalOpen(false)}
                title="Project Data (YAML)"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Full project source data.
                    </p>
                    <TextArea
                        value={yamlContent}
                        onChange={(e) => setYamlContent(e.target.value)}
                        rows={15}
                        className="font-mono text-xs leading-relaxed"
                    />
                    <div className="flex justify-between items-center pt-2">
                        <Button variant="ghost" className="flex items-center gap-2" onClick={() => downloadYaml(data)}>
                            <Download size={14} /> Download
                        </Button>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setIsYamlModalOpen(false)}>Cancel</Button>
                            <Button onClick={() => {
                                const parsed = parseYaml(yamlContent);
                                if (parsed) { setData(parsed); setIsYamlModalOpen(false); }
                                else alert("Invalid YAML");
                            }}>Apply Changes</Button>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                title="Create New Project"
            >
                <form onSubmit={addProject} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
                        <Input
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="e.g., Q4 Roadmap"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setIsProjectModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={!newProjectName.trim()}>Create</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                title="Delete Project?"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Are you sure? This cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setProjectToDelete(null)}>Cancel</Button>
                        <Button variant="danger" onClick={deleteProject}>Delete</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
}