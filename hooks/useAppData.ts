import { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { arrayMove } from '@dnd-kit/sortable';
import { AppData, Project, Task, ColumnId, ProjectStatus } from '../types';
import { saveToServer, loadFromServer } from '../services/yamlService';

const STORAGE_KEY = "kanban-data";

// Default empty state
const INITIAL_DATA: AppData = {
    projects: [],
    activeProjectId: '',
    theme: 'light',
};

// --- Helper Functions ---

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

export const useAppData = () => {
    const [data, setData] = useState<AppData>(INITIAL_DATA);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const isFirstLoad = useRef(true);
    
    // Save Queue Refs
    const isSaving = useRef(false);
    const pendingSave = useRef(false);
    const latestData = useRef(data);
    const ignoreNextSave = useRef(false);

    // Keep latestData synced
    useEffect(() => {
        latestData.current = data;
    }, [data]);

    // Load Data Effect
    useEffect(() => {
        const initData = async () => {
            try {
                const serverData = await loadFromServer(STORAGE_KEY) as unknown as AppData;

                if (serverData && serverData.projects && serverData.projects.length > 0) {
                    // We loaded data, we don't want this to trigger a save immediately
                    // The main Save Effect checks isFirstLoad, which handles this.
                    // 兼容性处理：如果老数据没有 status 字段，给个默认值
                    const patchedProjects = serverData.projects.map(p => ({
                        ...p,
                        status: p.status || 'active',
                        createdAt: p.createdAt || Date.now(),
                        updatedAt: p.updatedAt || Date.now()
                    }));
                    setData({ ...serverData, projects: patchedProjects });
                    if (serverData.theme === 'dark') document.documentElement.classList.add('dark');
                } else {
                    setData({
                        projects: [],
                        activeProjectId: '',
                        theme: 'light',
                        // @ts-ignore
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

    const doSave = useCallback(async () => {
        if (isSaving.current) {
            pendingSave.current = true;
            return;
        }

        isSaving.current = true;
        pendingSave.current = false;
        setSaveStatus('saving');

        try {
            const dataToSend = latestData.current;
            const result = await saveToServer(STORAGE_KEY, dataToSend);
            
            if (result.success && result.newVersion) {
                setSaveStatus('saved');
                // Update version locally without triggering another save loop
                ignoreNextSave.current = true;
                setData(prev => ({ ...prev, _version: result.newVersion }));
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error("Save error:", error);
            setSaveStatus('error');
        } finally {
            isSaving.current = false;
            // If a save was requested while we were saving, trigger it now
            if (pendingSave.current) {
                // Small delay to let UI breathe or batch updates
                setTimeout(() => doSave(), 100); 
            }
        }
    }, []);

    // Save Data Effect
    useEffect(() => {
        if (isLoading) return;

        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        if (ignoreNextSave.current) {
            ignoreNextSave.current = false;
            return;
        }

        if (data.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        // Debounce the save trigger
        const timer = setTimeout(() => {
            doSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [data, isLoading, doSave]);

    // --- Actions ---
    // 辅助：更新项目的 updatedAt 时间戳
    const touchProject = (projectId: string) => {
        return (p: Project) => {
            if (p.id === projectId) {
                return { ...p, updatedAt: Date.now() };
            }
            return p;
        };
    };

    const addProject = useCallback((name: string) => {
        const newProject: Project = {
            id: nanoid(),
            name,
            description: '',
            wipLimit: 3,
            status: 'active', // 默认新建的项目都是活跃的
            columns: { backlog: [], todo: [], 'in-progress': [], done: [] }
        };
        setData(prev => ({
            ...prev,
            projects: [...prev.projects, newProject],
            activeProjectId: newProject.id
        }));
    }, []);

    // 更新项目状态 (用于拖拽归档)
    const updateProjectStatus = useCallback((projectId: string, status: ProjectStatus) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => 
                p.id === projectId ? { ...p, status, updatedAt: Date.now() } : p
            )
        }));
    }, []);

    const updateProjectDescription = useCallback((projectId: string, desc: string) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === projectId ? { ...p, description: desc } : p)
        }));
    }, []);

    const updateWipLimit = useCallback((projectId: string, limit: number) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === projectId ? { ...p, wipLimit: limit } : p)
        }));
    }, []);

    const deleteProject = useCallback((projectId: string) => {
        setData(prev => {
            const remaining = prev.projects.filter(p => p.id !== projectId);
            if (remaining.length === 0) return prev; 
            return {
                ...prev,
                projects: remaining,
                // 如果删除的是当前项目，切换到第一个，否则保持不变
                activeProjectId: prev.activeProjectId === projectId ? remaining[0].id : prev.activeProjectId
            };
        });
    }, []);

    const addTask = useCallback((projectId: string, columnId: ColumnId, content: string) => {
        const newTask: Task = { id: nanoid(), content, createdAt: Date.now(), children: [] };
        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== projectId) return p;
                return {
                    ...p,
                    updatedAt: Date.now(),
                    columns: {
                        ...p.columns,
                        [columnId]: [...p.columns[columnId], newTask]
                    }
                };
            });
            return { ...prev, projects: projs };
        });
    }, []);

    const updateTask = useCallback((projectId: string, taskId: string, updates: Partial<Task>) => {
        const updateRecursive = (tasks: Task[]): Task[] => {
            return tasks.map(t => {
                if (t.id === taskId) return { ...t, ...updates };
                return { ...t, children: updateRecursive(t.children) };
            });
        };
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
                if (p.id !== projectId) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = updateRecursive(newCols[k]);
                });
                return { ...p, updatedAt: Date.now(), columns: newCols };
            })
        }));
    }, []);

    const addChildTask = useCallback((projectId: string, parentId: string, content: string) => {
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
                if (p.id !== projectId) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = addRecursive(newCols[k]);
                });
                return { ...p, updatedAt: Date.now(), columns: newCols };
            })
        }));
    }, []);

    const deleteTask = useCallback((projectId: string, taskId: string) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => {
                if (p.id !== projectId) return p;
                const newCols = { ...p.columns };
                (Object.keys(newCols) as ColumnId[]).forEach(k => {
                    newCols[k] = removeTask(newCols[k], taskId); 
                });
                return { ...p, updatedAt: Date.now(), columns: newCols };
            })
        }));
    }, []);

    const moveToColumn = useCallback((projectId: string, taskId: string, targetColId: ColumnId) => {
        setData(prev => {
            const projs = prev.projects.map(p => {
                if (p.id !== projectId) return p;
                
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
                return { ...p, updatedAt: Date.now(), columns: newCols };
            });
            return { ...prev, projects: projs };
        });
    }, []);

    const cloneTask = useCallback((projectId: string, taskId: string) => {
         const deepClone = (t: Task): Task => ({
            ...t, 
            id: nanoid(), 
            content: `${t.content} (Copy)`, 
            children: t.children.map(deepClone)
         });
    
         setData(prev => {
             const projs = prev.projects.map(p => {
                 if (p.id !== projectId) return p;
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
                 return { ...p, updatedAt: Date.now(), columns: newCols };
             });
             return { ...prev, projects: projs };
         });
    }, []);

    const updateProjectColumns = useCallback((projectId: string, newColumns: Record<ColumnId, Task[]>) => {
        setData(prev => ({
            ...prev,
            projects: prev.projects.map(p => p.id === projectId ? { ...p, columns: newColumns, updatedAt: Date.now()} : p)
        }));
    }, []);

    const setActiveProjectId = useCallback((id: string) => {
        setData(prev => ({ ...prev, activeProjectId: id }));
    }, []);
    
    const toggleTheme = useCallback(() => {
        setData(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
    }, []);


    // 项目排序方法
    const moveProject = useCallback((activeId: string, overId: string) => {
        setData((prev) => {
            const oldIndex = prev.projects.findIndex((p) => p.id === activeId);
            const newIndex = prev.projects.findIndex((p) => p.id === overId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                return {
                    ...prev,
                    projects: arrayMove(prev.projects, oldIndex, newIndex),
                };
            }
            return prev;
        });
    }, []);

    return {
        data,
        setData,
        isLoading,
        saveStatus,
        // Action methods
        addProject,
        updateProjectStatus,
        updateProjectDescription,
        updateWipLimit,
        updateProjectColumns, // Added this
        deleteProject,
        addTask,
        updateTask,
        addChildTask,
        deleteTask,
        moveProject,
        moveToColumn,
        cloneTask,
        setActiveProjectId,
        toggleTheme,
        // Helpers exposed if needed
        findTask,
        countLeaves
    };
};
