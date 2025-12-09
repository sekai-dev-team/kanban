import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom'; // 引入 createPortal
import { X } from 'lucide-react';
// 引入必要的 Hooks
import { 
    useFloating, 
    autoUpdate, 
    offset, 
    flip, 
    shift,
    useDismiss,     // 新增：处理点击外部关闭
    useClick,       // 新增：处理点击触发
    useInteractions // 新增：合并交互逻辑
} from '@floating-ui/react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden transform transition-all scale-100 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline' }> = ({
    className = '',
    variant = 'primary',
    ...props
}) => {
    const baseStyles = "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:ring-zinc-900 dark:focus:ring-zinc-100",
        ghost: "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-100",
        danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30",
        outline: "bg-transparent border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
    };

    return (
        <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />
    );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
    return (
        <input
            className={`w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-600 ${className}`}
            {...props}
        />
    );
};

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => {
    return (
        <textarea
            className={`w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-600 font-mono ${className}`}
            {...props}
        />
    );
};

// 创建一个 Context 用来传递关闭函数
const MenuContext = createContext<{ close: () => void } | null>(null);
interface MenuProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
}

export const Menu: React.FC<MenuProps> = ({ trigger, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // 1. 浮动定位配置
    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-end',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(4),
            flip(),
            shift({ padding: 8 }),
        ],
    });

    // 2. 交互配置 (点击和自动关闭)
    const click = useClick(context);
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
    ]);

    const close = () => setIsOpen(false);

    // 处理 Trigger
    const triggerElement = React.isValidElement(trigger) ? React.cloneElement(trigger, {
        ref: refs.setReference,
        ...getReferenceProps()
    } as React.HTMLAttributes<HTMLElement>) : (
        <div ref={refs.setReference} className="inline-block cursor-pointer" {...getReferenceProps()}>
            {trigger}
        </div>
    );

    return (
        <MenuContext.Provider value={{ close }}>
            {triggerElement}
            {isOpen && createPortal(
                /* ★ 修复关键：外层 div 只负责定位 
                   注意：移除了 className 里的样式和动画，只保留 ref 和 style
                */
                <div
                    ref={refs.setFloating}
                    style={{ ...floatingStyles, zIndex: 9999 }}
                    {...getFloatingProps()}
                    className="focus:outline-none" // 保持无轮廓，避免聚焦时的蓝框
                >
                    {/* ★ 修复关键：内层 div 负责样式、背景和动画
                       这样 transform 就不会打架了：外层负责位移，内层负责缩放
                    */}
                    <div className="w-56 rounded-md bg-white dark:bg-zinc-900 shadow-xl ring-1 ring-black ring-opacity-5 border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-100">
                        <div className="py-1">
                            {children}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </MenuContext.Provider>
    );
};

export const MenuItem: React.FC<{ onClick?: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => {
    // 获取 Context
    const menu = useContext(MenuContext);

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                // 先执行传入的功能逻辑
                onClick?.();
                // 然后关闭菜单
                menu?.close();
            }}
            className={`w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 ${className}`}
        >
            {children}
        </button>
    );
};
