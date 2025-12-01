// --- 类型定义文件 (Type Definitions) ---
// TypeScript 让我们在写代码时就能知道数据长什么样，减少 Bug。

// 定义列的ID，限制只能是这四个字符串之一。
// 这叫 "Union Type" (联合类型)。
export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'done';

// 核心：任务的定义
export interface Task {
  id: string;        // 唯一标识符，用于 React 渲染列表时的 key 和拖拽识别
  content: string;   // 卡片上的文字内容
  createdAt: number; // 创建时间戳
  
  // ★ 重点：递归定义 (Recursive Definition)
  // 一个任务可以包含子任务数组，而子任务本身又是 Task 类型。
  // 这就是为什么卡片里还能无限套娃卡片的根本原因。
  children: Task[];  
  
  isExpanded?: boolean; // 可选属性 (?)：记录当前卡片是否展开显示了子任务
}

// 项目的定义
export interface Project {
  id: string;
  name: string;
  description: string;
  wipLimit: number; // In-Progress 列的最大任务限制数 (WIP = Work In Progress)
  
  // columns 是一个对象映射
  // Key 必须是 ColumnId 类型，Value 是 Task 数组
  columns: {
    [key in ColumnId]: Task[];
  };
    _version?: number;
}

// 整个应用的数据状态 (Global State)
export interface AppData {
  projects: Project[];            // 所有项目的列表
  activeProjectId: string | null; // 当前正在查看哪个项目
  theme: 'light' | 'dark';        // 主题设置
    _version?: number;
}

// 列的静态配置数组，用于在页面上循环渲染出四列
export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

// --- 新增：拖拽状态定义 ---
// 用于指示当前拖拽的意图，仅仅用于 UI 展示，不影响真实数据
export interface DragState {
  type: 'nest' | 'insert'; // nest: 成为子卡片; insert: 插入排序
  targetId: string;        // 目标卡片 ID
  position?: 'top' | 'bottom'; // 仅在 insert 模式下有效，指示插入到目标上方还是下方
}
