## 核心文件

- **`App.tsx`**
  - 应用的主入口组件。
  - 负责整体布局结构（Sidebar + Main Content）。
  - 管理视图切换（Dashboard vs. Project Board）。
  - 集成全局 Hooks (`useAppData`, `useUI`) 并分发数据与操作方法。
  - 挂载全局模态框（新建项目、YAML 编辑等）。

## Hooks (逻辑层)

- **`hooks/useAppData.ts`**
  - **核心数据管理**：管理 `projects`, `tasks`, `activeProjectId` 等核心状态。
  - **业务逻辑**：提供 `addProject`, `addTask`, `deleteTask`, `moveToColumn` 等所有对数据的 CRUD 操作。
  - **数据持久化**：负责调用 `yamlService` 进行数据的加载和自动保存（防抖保存机制）。

- **`hooks/useDnd.ts`**
  - **拖拽逻辑封装**：基于 `@dnd-kit` 实现。
  - **交互处理**：处理 `onDragStart`, `onDragOver`, `onDragEnd` 事件。
  - **复杂移动策略**：判断任务是排序、跨列移动，还是嵌套（成为子任务）。

- **`hooks/useUI.ts`**
  - **UI 状态管理**：管理非业务数据的 UI 状态，如模态框的开关 (`isModalOpen`)、搜索栏状态、侧边栏折叠状态等。
  - **快捷键监听**：处理全局快捷键（如 Ctrl+K 唤起搜索）。

## Services (服务层)

- **`services/yamlService.ts`**
  - **API 通信**：封装 `fetch` 请求，与后端 API 进行数据交互 (`loadFromServer`, `saveToServer`)。
  - **数据转换**：处理数据的序列化与反序列化（支持 JSON/YAML 转换）。

## Components (视图层)

### Dashboard (`components/dashboard/`)
- **`Dashboard.tsx`**：首页仪表盘，概览所有项目，支持按状态（Planning, Active, Completed）拖拽管理项目。
- **`ProjectCard.tsx`**：仪表盘中的单个项目卡片组件。

### Layout (`components/layout/`)
- **`Board.tsx`**：具体的项目看板视图，渲染 Columns 和 Tasks，处理看板内的拖拽交互。
- **`Sidebar.tsx`**：全局侧边导航栏，显示项目列表、搜索框和设置入口。
- **`MainHeader.tsx`**：看板视图的顶部栏，显示项目信息和面包屑。

### UI & Modals
- **`components/ui.tsx`**：基础 UI 组件库（Button, Input 等）。
- **`components/modals/`**：包含新建项目、删除确认、YAML 编辑等各种弹窗组件。
