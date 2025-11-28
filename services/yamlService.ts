import yaml from 'js-yaml';
import { AppData, Project } from '../types';

const STORAGE_KEY = 'sekai_board_data_v2';

const DEFAULT_PROJECT: Project = {
    id: 'default-1',
    name: 'Demo Project',
    description: 'A sample project to demonstrate Sekai Board features.',
    wipLimit: 3,
    columns: {
        backlog: [
            {
                id: 't1',
                content: 'Explore Sekai Board features',
                createdAt: Date.now(),
                children: [
                    { id: 't1-1', content: 'Test Drag and Drop', createdAt: Date.now(), children: [] },
                    { id: 't1-2', content: 'Try Dark Mode', createdAt: Date.now(), children: [] }
                ],
                isExpanded: true
            },
            { id: 't2', content: 'Draft initial requirements', createdAt: Date.now(), children: [] }
        ],
        todo: [
            { id: 't3', content: 'Design system setup', createdAt: Date.now(), children: [] }
        ],
        'in-progress': [],
        done: []
    }
};

const DEFAULT_DATA: AppData = {
    projects: [DEFAULT_PROJECT],
    activeProjectId: 'default-1',
    theme: 'light'
};

export const saveToStorage = (data: AppData) => {
    try {
        const yamlString = yaml.dump(data);
        localStorage.setItem(STORAGE_KEY, yamlString);
    } catch (e) {
        console.error('Failed to save data', e);
    }
};

export const loadFromStorage = (): AppData => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return DEFAULT_DATA;

        const parsed = yaml.load(stored) as AppData;
        // Basic validation
        if (!parsed.projects || !Array.isArray(parsed.projects)) {
            return DEFAULT_DATA;
        }
        return parsed;
    } catch (e) {
        console.error('Failed to load data', e);
        return DEFAULT_DATA;
    }
};

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

export const saveToServer = async (data: AppData): Promise<boolean> => {
    const delay = 500 + Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log('[Mock Server] Data saved to /data/sekai_board.yaml', data);
    return true;
};

export const downloadYaml = (data: AppData, filename = 'sekai_board.yaml') => {
    try {
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
