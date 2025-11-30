import React, { useState, useEffect, useMemo, useRef } from 'react';
// 引入 dnd-kit 库
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  pointerWithin, // Changed: Use pointerWithin for strict cursor based detection
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  ClientRect,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { 
  Plus, Layout, Moon, Sun, Database, CheckCircle2, Folder, Trash, 
  Loader2, AlertCircle, Download, Search, Sparkles
} from 'lucide-react';
import { nanoid } from 'nanoid';

// 本地组件引用
import { Project, Task, COLUMNS, AppData, ColumnId, DragState } from './types';
import { saveToStorage, loadFromStorage, exportToYaml, parseYaml, saveToServer, downloadYaml } from './services/yamlService';
import { Column } from './components/Column';
import { SortableTask } from './components/SortableTask';
import { Modal, Button, Input, TextArea } from './components/ui';
import { AIChat } from './components/AIChat';

// --- 辅助函数区 ---

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

// 检查 targetId 是否是 sourceId 的后代
const isDescendant = (tasks: Task[], sourceId: string, targetId: string): boolean => {
  const source = findTask(tasks, sourceId);
  if (!source) return false;
  return !!findTask(source.children, targetId);
};

const removeTask = (tasks: Task[], id: string): Task[] => {
  return tasks.filter(t => t.id !== id).map(t => ({
    ...t,
    children: removeTask(t.children, id)
  }));
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

// Helper to strip sub-zone suffixes
const getRealId = (id: string): string => {
  if (id.endsWith('-top')) return id.replace('-top', '');
  if (id.endsWith('-mid')) return id.replace('-mid', '');
  if (id.endsWith('-bot')) return id.replace('-bot', '');
  return id;
};

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: '0.5' },
    },
  }),
};

export default function App() {
  const [data, setData] = useState<AppData>(loadFromStorage);
  
  // DnD 状态
  const [activeId, setActiveId] = useState<string | null>(null); 
  const [activeTask, setActiveTask] = useState<Task | null>(null); 
  
  // ★ 视觉指示器状态
  const [dragState, setDragState] = useState<DragState | null>(null);

  // UI 状态
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isYamlModalOpen, setIsYamlModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeProject = useMemo(() => 
    data.projects.find(p => p.id === data.activeProjectId) || data.projects[0]
  , [data.projects, data.activeProjectId]);

  const filteredProjects = data.projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const wipCount = useMemo(() => 
    activeProject ? countLeaves(activeProject.columns['in-progress']) : 0
  , [activeProject]);

  useEffect(() => {
    saveToStorage(data); 
    if (data.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveToServer(data);
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error');
      }
    }, 1000);
    return () => clearTimeout(timer); 
  }, [data]);

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

  // --- 项目操作 Handlers ---
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

  // --- 任务操作 Handlers ---

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

    setData(prev => {
        const projs = prev.projects.map(p => {
            if (p.id !== activeProject.id) return p;
            const tempCols = { ...p.columns };
            let foundTask: Task | undefined;
            (Object.keys(tempCols) as ColumnId[]).forEach(k => {
                 const find = findTask(tempCols[k], taskId);
                 if(find) foundTask = find;
            });

            if (targetColId === 'in-progress' && foundTask) {
                const currentLeaves = countLeaves(tempCols['in-progress']);
                const incomingLeaves = foundTask.children.length === 0 ? 1 : countLeaves(foundTask.children);
                if (currentLeaves + incomingLeaves > p.wipLimit) {
                    alert(`WIP Limit Reached! Limit: ${p.wipLimit}`);
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
                 if(t) foundClone = deepClone(t);
             });

             if(foundClone) {
                 (Object.keys(newCols) as ColumnId[]).forEach(k => {
                     if(findTask(newCols[k], taskId)) {
                         newCols[k] = [...newCols[k], foundClone!];
                     }
                 });
             }
             return { ...p, columns: newCols };
         });
         return { ...prev, projects: projs };
     });
  };

  // --- 核心重构：拖拽逻辑 (Indicator Based DnD) ---

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    let task: Task | undefined;
    (Object.keys(activeProject.columns) as ColumnId[]).forEach(k => {
        const found = findTask(activeProject.columns[k], active.id as string);
        if(found) task = found;
    });
    setActiveTask(task || null);
  };

  // ★ DragOver: 计算 DragState (Visual)
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const isClone = (event.activatorEvent as any)?.ctrlKey; 
    
    if (!over || isClone) {
      setDragState(null);
      return;
    }

    const activeId = active.id as string;
    const rawOverId = over.id as string;
    const overId = getRealId(rawOverId);

    // 自指检测
    if (activeId === overId) {
      setDragState(null);
      return;
    }

    // 后代检测
    const allTasks = Object.values(activeProject.columns).flat();
    if (isDescendant(allTasks, activeId, overId)) {
      setDragState(null);
      return;
    }

    // 1. 如果 Over 的是 Column 本身 (e.g. 标题、底部空白)
    if (Object.keys(activeProject.columns).includes(rawOverId)) {
      const columnId = rawOverId as ColumnId;
      const tasksInColumn = activeProject.columns[columnId];
      
      const overTop = over.rect.top;
      // Use active rect center to decide top vs bottom of column
      const activeCenterY = active.rect.current.translated!.top + (active.rect.current.translated!.height / 2);
      
      // Header threshold: let's say 50px from top of column
      const headerThreshold = overTop + 50; 
      
      if (activeCenterY < headerThreshold) {
         // Insert at top of column
         setDragState({ type: 'insert', position: 'top', targetId: rawOverId });
      } else {
         // Insert at bottom of column
         // If there are tasks, target the last one for better visual placement
         // This ensures the blue line appears right after the last card, not at the bottom of the container
         if (tasksInColumn.length > 0) {
             const lastTask = tasksInColumn[tasksInColumn.length - 1];
             // Don't target self if dragging the last item
             if (lastTask.id !== activeId) {
                setDragState({ type: 'insert', position: 'bottom', targetId: lastTask.id });
                return;
             }
         }
         // Fallback for empty column or if last task is self (just show column bottom line)
         setDragState({ type: 'insert', position: 'bottom', targetId: rawOverId });
      }
      return;
    }

    // 2. 如果 Over 的是 Task Zone (Explicit Zones)
    // 根据后缀判断意图，不再进行坐标计算！
    if (rawOverId.endsWith('-top')) {
      setDragState({ type: 'insert', position: 'top', targetId: overId });
      return;
    }
    if (rawOverId.endsWith('-mid')) {
      setDragState({ type: 'nest', targetId: overId });
      return;
    }
    if (rawOverId.endsWith('-bot')) {
      setDragState({ type: 'insert', position: 'bottom', targetId: overId });
      return;
    }
    
    // 3. Fallback: 如果碰到了 Task Container 本身 (可能是因为缝隙或者 margin)
    // 默认认为 Nest (或者不做处理，防止闪烁)
    setDragState({ type: 'nest', targetId: overId });
  };

  // ★ DragEnd: 提交修改
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveTask(null);
    const finalDragState = dragState; 
    setDragState(null);

    if (!over) return;

    const isClone = (event.activatorEvent as any)?.ctrlKey;
    
    setData(prev => {
        const activeProj = prev.projects.find(p => p.id === activeProject.id);
        if (!activeProj) return prev;
        
        const newCols = JSON.parse(JSON.stringify(activeProj.columns)); 

        // A. 准备待移动任务
        let taskToMove: Task | null = null;

        if (isClone) {
           const findOriginal = (tasks: Task[]): Task | undefined => {
              for (const t of tasks) {
                 if (t.id === active.id) return t;
                 const f = findOriginal(t.children);
                 if (f) return f;
              }
              return undefined;
           };
           const original = findOriginal(Object.values(activeProj.columns).flat());
           if (original) {
               const deepCloneTask = (t: Task): Task => ({
                   ...t,
                   id: nanoid(),
                   content: t.content, 
                   children: t.children.map(deepCloneTask)
               });
               taskToMove = deepCloneTask(original);
           }
        } else {
           const removeFromTree = (tasks: Task[]): Task[] => {
              const res: Task[] = [];
              for (const t of tasks) {
                 if (t.id === active.id) {
                    taskToMove = t; 
                 } else {
                    t.children = removeFromTree(t.children);
                    res.push(t);
                 }
              }
              return res;
           };
           (Object.keys(newCols) as ColumnId[]).forEach(k => {
               newCols[k] = removeFromTree(newCols[k]);
           });
        }

        if (!taskToMove) return prev; 

        // B. 执行插入
        if (finalDragState) {
            const { targetId, type, position } = finalDragState;

            // 情况1: 目标是 Column
            if (Object.keys(newCols).includes(targetId)) {
                if (position === 'top') {
                    newCols[targetId].unshift(taskToMove);
                } else {
                    if (targetId === 'in-progress') {
                        const currentLeaves = countLeaves(newCols['in-progress']);
                        const incomingLeaves = (taskToMove as Task).children.length === 0 ? 1 : countLeaves((taskToMove as Task).children);
                        if (currentLeaves + incomingLeaves > activeProj.wipLimit && !isClone) {
                             // Limit handling logic
                        }
                    }
                    newCols[targetId].push(taskToMove);
                }
                return { ...prev, projects: prev.projects.map(p => p.id === activeProject.id ? { ...p, columns: newCols } : p) };
            }

            // 情况2: 目标是 Task (Nest / Insert)
            const findTargetAndAction = (tasks: Task[]) => {
                 for (let i = 0; i < tasks.length; i++) {
                     const t = tasks[i];
                     if (t.id === targetId) {
                         if (type === 'nest') {
                             t.children.push(taskToMove!);
                             t.isExpanded = true; 
                         } else if (type === 'insert') {
                             const index = position === 'top' ? i : i + 1;
                             tasks.splice(index, 0, taskToMove!);
                         }
                         return true; 
                     }
                     if (findTargetAndAction(t.children)) return true;
                 }
                 return false;
             };

             let handled = false;
             (Object.keys(newCols) as ColumnId[]).forEach(k => {
                 if (!handled) handled = findTargetAndAction(newCols[k]);
             });
             
             if (!handled) {
                 newCols['backlog'].push(taskToMove); 
             }
        } else {
            // Fallback (e.g. dropped on background)
            if (!isClone) {
                 newCols['backlog'].push(taskToMove);
            }
        }

        return { ...prev, projects: prev.projects.map(p => p.id === activeProject.id ? { ...p, columns: newCols } : p) };
    });
  };

  // --- 渲染 ---
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-gray-100 font-sans overflow-hidden">
      
      {/* Sidebar */}
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
                        setData(p => ({...p, activeProjectId: project.id}));
                        setSearchQuery('');
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                        project.id === activeProject.id 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Folder size={16} className={project.id === activeProject.id ? 'fill-current opacity-20' : ''} />
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
            <Button variant="ghost" className="w-full flex items-center justify-start gap-2 px-3 py-2.5" onClick={() => setData(p => ({...p, theme: p.theme === 'light' ? 'dark' : 'light'}))}>
                {data.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <span>{data.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </Button>
        </div>
      </aside>

      {/* Main Board */}
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
                    <input 
                        className="w-full bg-transparent text-sm text-gray-500 dark:text-gray-400 focus:text-gray-800 dark:focus:text-gray-200 focus:outline-none border-b border-transparent focus:border-gray-200 dark:focus:border-zinc-700 transition-colors pb-0.5"
                        value={activeProject.description || ''}
                        onChange={(e) => updateProjectDescription(e.target.value)}
                        placeholder="Add a project description..."
                    />
                </div>
                
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
                     {saveStatus === 'error' && <AlertCircle size={16} className="text-red-500" />}
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin} // Use pointerWithin!
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
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
                            dragState={dragState} 
                        />
                    ))}
                </div>
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeTask ? (
                        <div className="opacity-90 rotate-2 cursor-grabbing">
                             <SortableTask 
                                task={activeTask} 
                                onDelete={()=>{}} 
                                onUpdate={()=>{}} 
                                onAddChild={()=>{}} 
                                onMoveToColumn={()=>{}}
                                onClone={()=>{}}
                                dragState={null}
                                isOverlay={true} // Inform that this is overlay
                             />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
      </main>

      <AIChat 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)}
        data={data}
        onUpdateData={(newData) => setData(newData)}
      />

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