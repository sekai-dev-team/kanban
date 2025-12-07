import React from 'react';
import { Modal, Button, Input } from '../ui';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    newProjectName: string;
    setNewProjectName: (name: string) => void;
    addProject: (name: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
    isOpen,
    onClose,
    newProjectName,
    setNewProjectName,
    addProject
}) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        addProject(newProjectName);
        setNewProjectName('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Project"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={!newProjectName.trim()}>Create</Button>
                </div>
            </form>
        </Modal>
    );
};
