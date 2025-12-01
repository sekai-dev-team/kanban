import yaml from 'js-yaml';
import { AppData, Project } from '../types';

// 定义一个固定的 ID，后端会生成 data/main-board-data.yaml
// 这样整个 App 的所有项目都存在这一个文件里
const API_BASE_URL = 'http://10.239.88.106:8000';

export const DEFAULT_DATA: AppData = {
    projects: [],
    activeProjectId: 'default-1',
    theme: 'light',
    // @ts-ignore
    _version: 1
};

// --- Local Storage Helpers (Optional/Backup) ---

export const exportToYaml = (data: AppData): string => {
    return yaml.dump(data);
};

export const parseYaml = (yamlString: string): AppData | null => {
    try {
        return yaml.load(yamlString) as AppData;
    } catch (e) {
        return null;
    }
};

// --- API Services ---

/**
 * 从服务器加载整个应用数据
 * @param storageId 用于存储的文件名ID (例如 'main-board-data')
 */
export const loadFromServer = async (storageId: string): Promise<AppData | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/kanban/${storageId}`);

        if (response.status === 404) {
            console.log(`Storage ID '${storageId}' not found, initializing default.`);
            return null; // 让 App.tsx 使用默认值
        }

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const rawData = await response.json();

        // 确保返回的数据符合 AppData 结构
        // 注意：rawData 中会包含后端注入的 '_version' 字段，这很重要，需要保留在对象中
        return rawData as AppData;

    } catch (e) {
        console.error('Failed to load data from server', e);
        return null; // 出错时也返回 null，由 UI 决定显示错误或默认值
    }
};

/**
 * 保存整个应用数据到服务器
 * @param storageId 用于存储的文件名ID
 * @param data 整个 AppData 对象
 */
export const saveToServer = async (storageId: string, data: AppData): Promise<{ success: boolean, newVersion?: number }> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/kanban/${storageId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 将整个 AppData 序列化发送
            body: JSON.stringify(data),
        });

        if (response.status === 409) {
            // 409 Conflict: 意味着服务器版本比本地高 (被其他人修改了)
            console.warn('Version conflict detected.');
            alert('Save conflict! Data has been modified externally. Please refresh.');
            return { success: false };
        }

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log('[API Server] Data saved successfully. Version:', responseData.new_version);

        // 更新本地数据的版本号，以便下一次保存（虽然 React State 可能会在下一次 fetch 前覆盖它，但这是一个好习惯）
        if (responseData.new_version) {
            (data as any)._version = responseData.new_version;
        }

        return { success: true, newVersion: responseData.new_version };

    } catch (e) {
        console.error('Failed to save data to server', e);
        // 这里可以选择不 alert，而在 UI 上显示一个小红点
        return { success: false };
    }
};

export const downloadYaml = (data: AppData, filename = 'sekai_board.yaml') => {
    try {
        // 在下载 YAML 时，通常不需要 _version 字段，可以选择剔除，也可以保留
        const yamlStr = exportToYaml(data);
        const blob = new Blob([yamlStr], { type: 'text/yaml;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e) {
        console.error('Download failed', e);
    }
};