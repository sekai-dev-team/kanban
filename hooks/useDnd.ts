import { useState } from 'react';
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
import { Project, Task, ColumnId, DragState } from '../types';

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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

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
    
        const isClone = (event.activatorEvent as any)?.ctrlKey;
        
        const newCols = JSON.parse(JSON.stringify(activeProject.columns)); 

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
           const original = findOriginal(Object.values(activeProject.columns).flat());
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

        if (!taskToMove) return; 

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
                        if (currentLeaves + incomingLeaves > activeProject.wipLimit && !isClone) {
                             // Limit handling logic can be added here or via callback if needed
                        }
                    }
                    newCols[targetId].push(taskToMove);
                }
                updateProjectColumns(activeProject.id, newCols);
                return;
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

        updateProjectColumns(activeProject.id, newCols);
    };

    return {
        activeId,
        activeTask,
        dragState,
        sensors,
        onDragStart,
        onDragOver,
        onDragEnd
    };
};
