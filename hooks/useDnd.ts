import { useState, useEffect } from 'react';
import { 
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { nanoid } from 'nanoid';
import { Project, Task, ColumnId, DragState, AutoGroupState } from '../types';
import { useCtrlPress } from './useCtrlPress';

// Helper functions needed for DnD logic
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

const isDescendant = (tasks: Task[], sourceId: string, targetId: string): boolean => {
  const source = findTask(tasks, sourceId);
  if (!source) return false;
  return !!findTask(source.children, targetId);
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

const findParent = (tasks: Task[], childId: string): Task | undefined => {
  for (const task of tasks) {
    if (task.children.some(c => c.id === childId)) return task;
    const found = findParent(task.children, childId);
    if (found) return found;
  }
  return undefined;
};

const findMatchingParent = (tasks: Task[], targetIdentityId: string): Task | undefined => {
  for (const task of tasks) {
    // 1. 匹配副本: 任务是本尊的另一个分身 (sourceId 相同)
    if (task.sourceId === targetIdentityId) return task;
    // 2. 匹配本尊: 任务就是本尊自己 (id 相同)
    if (task.id === targetIdentityId) return task;
    
    const found = findMatchingParent(task.children, targetIdentityId);
    if (found) return found;
  }
  return undefined;
};

const getRealId = (id: string): string => {
  if (id.endsWith('-top')) return id.replace('-top', '');
  if (id.endsWith('-mid')) return id.replace('-mid', '');
  if (id.endsWith('-bot')) return id.replace('-bot', '');
  return id;
};

export const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: '0.5' },
    },
  }),
};

interface UseDndProps {
    activeProject: Project;
    updateProjectColumns: (projectId: string, newColumns: Record<ColumnId, Task[]>) => void;
}

export const useDnd = ({ activeProject, updateProjectColumns }: UseDndProps) => {
    const [activeId, setActiveId] = useState<string | null>(null); 
    const [activeTask, setActiveTask] = useState<Task | null>(null); 
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [autoGroupState, setAutoGroupState] = useState<AutoGroupState>(null);
    
    const isCtrlPressed = useCtrlPress();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Calculate AutoGroup Visual State
    useEffect(() => {
        if (!activeId || !dragState || !isCtrlPressed) {
            setAutoGroupState(null);
            return;
        }

        // Logic must match onDragEnd
        const allTasks = Object.values(activeProject.columns).flat();
        const originalParent = findParent(allTasks, activeId);
        
        // Find source column
        let sourceColumnId: string | undefined;
        (Object.keys(activeProject.columns) as ColumnId[]).forEach(k => {
            if (findTask(activeProject.columns[k], activeId)) {
                sourceColumnId = k;
            }
        });

        // Check for Duplication (Top Level + Ctrl)
        if (!originalParent) {
             setAutoGroupState({ type: 'duplicate' });
             return;
        }

        // Find target column based on dragState.targetId
        let targetColumnId: string | undefined;
        // Case 1: Target is Column
        if (Object.keys(activeProject.columns).includes(dragState.targetId)) {
            targetColumnId = dragState.targetId;
        } else {
            // Case 2: Target is Task -> Find its column
            (Object.keys(activeProject.columns) as ColumnId[]).forEach(k => {
                 if (findTask(activeProject.columns[k], dragState.targetId)) {
                     targetColumnId = k;
                 }
            });
        }

        if (originalParent && sourceColumnId && targetColumnId && sourceColumnId !== targetColumnId) {
            // **New Logic**: Even if nesting, enable Auto-Group if Ctrl is pressed
            // Previously: if (dragState.type === 'nest') return;
            
            const targetColumnTasks = activeProject.columns[targetColumnId as ColumnId];
            const identityId = originalParent.sourceId || originalParent.id;
            const matchingParent = findMatchingParent(targetColumnTasks, identityId);

            if (matchingParent) {
                setAutoGroupState({ type: 'group-existing', parentId: matchingParent.id });
            } else {
                setAutoGroupState({ type: 'create-parent' });
            }
        } else {
            setAutoGroupState(null);
        }

    }, [activeId, dragState, isCtrlPressed, activeProject]);

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

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        // Removed isClone check here to allow interaction with Ctrl key
        
        if (!over) {
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
    
        // 1. 如果 Over 的是 Column 本身
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
             if (tasksInColumn.length > 0) {
                 const lastTask = tasksInColumn[tasksInColumn.length - 1];
                 // Don't target self if dragging the last item
                 if (lastTask.id !== activeId) {
                    setDragState({ type: 'insert', position: 'bottom', targetId: lastTask.id });
                    return;
                 }
             }
             setDragState({ type: 'insert', position: 'bottom', targetId: rawOverId });
          }
          return;
        }
    
        // 2. 如果 Over 的是 Task Zone (Explicit Zones)
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
        
        // 3. Fallback
        setDragState({ type: 'nest', targetId: overId });
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        setActiveId(null);
        setActiveTask(null);
        const finalDragState = dragState; 
        setDragState(null);
    
        if (!over) return;
    
        // Ctrl key logic
        const ctrlKey = (event.activatorEvent as any)?.ctrlKey || isCtrlPressed;
        
        const newCols = JSON.parse(JSON.stringify(activeProject.columns)); 

        // 查找源数据（在移除之前）
        const allTasks = Object.values(activeProject.columns).flat();
        const originalParent = findParent(allTasks, active.id as string);
        let sourceColumnId: string | undefined;
        (Object.keys(activeProject.columns) as ColumnId[]).forEach(k => {
            if (findTask(activeProject.columns[k], active.id as string)) {
                sourceColumnId = k;
            }
        });

        const isTopLevel = !originalParent;
        // Duplicate if Ctrl is pressed AND it's a top-level task
        const isDuplicateOperation = ctrlKey && isTopLevel;

        // A. 准备待移动任务 (Move or Clone)
        let taskToMove: Task | null = null;
        
        if (isDuplicateOperation) {
             const sourceTask = findTask(allTasks, active.id as string);
             if (sourceTask) {
                 taskToMove = {
                     ...sourceTask,
                     id: nanoid(),
                     children: [], // 复制时不携带子卡片
                     sourceId: sourceTask.sourceId || sourceTask.id
                 };
             }
             // Do NOT remove original from newCols
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

        if (!taskToMove) return; 

        // B. 执行插入
        if (finalDragState) {
            const { targetId, type, position } = finalDragState;

            // 情况1: 目标是 Column (即拖到了列的根部/空白处)
            if (Object.keys(newCols).includes(targetId)) {
                
                // --- Logic: Auto-Grouping ONLY if Ctrl is pressed (Preserve Context) ---
                const isCrossColumn = sourceColumnId && sourceColumnId !== targetId;
                
                // Note: isDuplicateOperation implies !originalParent, so this block is naturally skipped for duplicates
                if (ctrlKey && originalParent && isCrossColumn) {
                    const targetColumnTasks = newCols[targetId as ColumnId];
                    const identityId = originalParent.sourceId || originalParent.id;
                    const matchingParent = findMatchingParent(targetColumnTasks, identityId);

                    if (matchingParent) {
                        // Found matching parent -> Group under it
                        matchingParent.children.push(taskToMove);
                        matchingParent.isExpanded = true;
                        updateProjectColumns(activeProject.id, newCols);
                        return;
                    } else {
                        // No match -> Copy parent -> Group under new parent
                        const parentCopy: Task = {
                            ...originalParent,
                            id: nanoid(), 
                            sourceId: identityId, 
                            children: [taskToMove],
                        };
                        
                        // Insert at bottom when no parent found (user requirement)
                        newCols[targetId].push(parentCopy);
                        
                        updateProjectColumns(activeProject.id, newCols);
                        return;
                    }
                }
                // --- End Auto-Grouping Logic ---

                // Standard Drop (Become Top-Level Task)
                if (position === 'top') {
                    newCols[targetId].unshift(taskToMove);
                } else {
                    if (targetId === 'in-progress') {
                        const currentLeaves = countLeaves(newCols['in-progress']);
                        const incomingLeaves = (taskToMove as Task).children.length === 0 ? 1 : countLeaves((taskToMove as Task).children);
                        if (currentLeaves + incomingLeaves > activeProject.wipLimit) {
                             // Limit handling logic can be added here or via callback if needed
                        }
                    }
                    newCols[targetId].push(taskToMove);
                }
                updateProjectColumns(activeProject.id, newCols);
                return;
            }

            // 情况2: 目标是 Task (Nest / Insert)
            // Revised iteration to handle Context Preserve on Insert AND Nest
            let handled = false;
            (Object.keys(newCols) as ColumnId[]).forEach(k => {
                if (handled) return;

                // Helper recursive function that knows about the current column ID
                const findAndHandle = (tasks: Task[], colId: string): boolean => {
                   for (let i = 0; i < tasks.length; i++) {
                       const t = tasks[i];
                       if (t.id === targetId) {
                           
                           // Check for Preserve Context Logic
                           const isCrossColumn = sourceColumnId && sourceColumnId !== colId;
                           
                           // Logic applies to BOTH 'insert' and 'nest' modes if Ctrl + Cross-Column + Has Parent
                           if (ctrlKey && originalParent && isCrossColumn) {
                               const targetColumnTasks = newCols[colId as ColumnId];
                               const identityId = originalParent.sourceId || originalParent.id;
                               const matchingParent = findMatchingParent(targetColumnTasks, identityId);
                               
                               if (matchingParent) {
                                   // Case A: Parent Exists -> Group into it (Ignore specific insert position/target)
                                   matchingParent.children.push(taskToMove!);
                                   matchingParent.isExpanded = true;
                                   return true;
                               } else {
                                   // Case B: Parent Doesn't Exist -> Create Copy -> Insert at Column BOTTOM
                                   const parentCopy: Task = {
                                       ...originalParent,
                                       id: nanoid(), 
                                       sourceId: identityId, 
                                       children: [taskToMove!],
                                   };
                                   
                                   // User Requirement: "If no parent then copy parent at outermost bottom of column"
                                   // Push to root column array
                                   newCols[colId as ColumnId].push(parentCopy);
                                   return true;
                               }
                           }

                           // Standard Logic
                           if (type === 'nest') {
                               t.children.push(taskToMove!);
                               t.isExpanded = true; 
                           } else if (type === 'insert') {
                               const index = position === 'top' ? i : i + 1;
                               tasks.splice(index, 0, taskToMove!);
                           }
                           return true; 
                       }
                       if (findAndHandle(t.children, colId)) return true;
                   }
                   return false;
                };

                if (findAndHandle(newCols[k], k)) handled = true;
            });
            
            if (!handled) {
                newCols['backlog'].push(taskToMove); 
            }
        } else {
            // Fallback
             newCols['backlog'].push(taskToMove);
        }

        updateProjectColumns(activeProject.id, newCols);
    };

    return {
        activeId,
        activeTask,
        dragState,
        autoGroupState, // Exposed for UI feedback
        sensors,
        onDragStart,
        onDragOver,
        onDragEnd
    };
};
