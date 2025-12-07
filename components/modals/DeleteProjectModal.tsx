import React from 'react';
import { Modal, Button } from '../ui';

interface DeleteProjectModalProps {
    projectToDelete: string | null;
    setProjectToDelete: (id: string | null) => void;
    deleteProject: (id: string) => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
    projectToDelete,
    setProjectToDelete,
    deleteProject
}) => {
    if (!projectToDelete) return null;

    return (
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
                    <Button variant="danger" onClick={() => {
                        deleteProject(projectToDelete);
                        setProjectToDelete(null);
                    }}>Delete</Button>
                </div>
            </div>
        </Modal>
    );
};
