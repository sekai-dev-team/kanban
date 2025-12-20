import { useState, useRef, useEffect } from 'react';

export const useUI = () => {
    const [isYamlModalOpen, setIsYamlModalOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [yamlContent, setYamlContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isYamlModalOpen, setIsYamlModalOpen,
        isProjectModalOpen, setIsProjectModalOpen,
        isAiOpen, setIsAiOpen,
        isSearchOpen, setIsSearchOpen,
        projectToDelete, setProjectToDelete,
        newProjectName, setNewProjectName,
        yamlContent, setYamlContent,
        searchQuery, setSearchQuery,
        highlightedTaskId, setHighlightedTaskId,
        searchInputRef
    };
};
