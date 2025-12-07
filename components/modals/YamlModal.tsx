import React from 'react';
import { Download } from 'lucide-react';
import { AppData } from '../../types';
import { Modal, Button, TextArea } from '../ui';
import { parseYaml, downloadYaml } from '../../services/yamlService';

interface YamlModalProps {
    isOpen: boolean;
    onClose: () => void;
    yamlContent: string;
    setYamlContent: (content: string) => void;
    data: AppData;
    setData: (data: AppData) => void;
}

export const YamlModal: React.FC<YamlModalProps> = ({
    isOpen,
    onClose,
    yamlContent,
    setYamlContent,
    data,
    setData
}) => {
    const handleApply = () => {
        const parsed = parseYaml(yamlContent);
        if (parsed) { 
            setData(parsed); 
            onClose(); 
        } else {
            alert("Invalid YAML");
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
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
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleApply}>Apply Changes</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
