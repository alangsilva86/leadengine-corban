import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { Ellipsis } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { DEFAULT_QUICK_ACTIONS, PRIMARY_ACTION_IDS, } from '@/features/chat/actions/inventory';
import { Tooltip, TooltipContent, TooltipTrigger, } from '@/components/ui/tooltip.jsx';
import { getAllAnchorIdsForCommand, getPrimaryCommandAnchorId } from '../../actions/commandAnchors.js';
import AssignTicketPopover from './AssignTicketPopover.jsx';
const ACTION_BUTTON_CLASSES = 'inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const focusableTagNames = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const normalizeActions = (context) => DEFAULT_QUICK_ACTIONS.map((action) => {
    const canExecute = action.canExecute?.(context) ?? true;
    return {
        definition: action,
        canExecute,
        state: action.getState?.(context) ?? {},
    };
});
const groupActions = (resolved) => {
    const primary = [];
    const secondary = [];
    for (const entry of resolved) {
        if (PRIMARY_ACTION_IDS.includes(entry.definition.id) && primary.length < 3) {
            primary.push(entry);
        }
        else {
            secondary.push(entry);
        }
    }
    return { primary, secondary };
};
const useSlashShortcuts = (actions, context, focusMap) => {
    useEffect(() => {
        if (!actions || actions.length === 0) {
            return undefined;
        }
        let awaitingShortcut = false;
        const handleKeyDown = (event) => {
            if (event.defaultPrevented)
                return;
            const target = event.target;
            if (target instanceof HTMLElement) {
                if (target.isContentEditable || focusableTagNames.has(target.tagName)) {
                    return;
                }
            }
            const key = event.key.toLowerCase();
            if (key === '/') {
                awaitingShortcut = true;
                return;
            }
            if (!awaitingShortcut)
                return;
            awaitingShortcut = false;
            const entry = actions.find((item) => item.definition.shortcut && item.definition.shortcut.toLowerCase() === key);
            if (!entry || !entry.canExecute) {
                return;
            }
            event.preventDefault();
            const element = focusMap.current.get(entry.definition.id) ?? null;
            const contextWithFocus = { ...context, returnFocus: element };
            entry.definition.run(contextWithFocus);
            entry.definition.analytics?.(contextWithFocus);
        };
        const handleKeyUp = (event) => {
            if (event.key === '/') {
                awaitingShortcut = false;
            }
        };
        const handleBlur = () => {
            awaitingShortcut = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [actions, context, focusMap]);
};
const CommandButton = ({ entry, context, focusMap }) => {
    const { definition, canExecute, state } = entry;
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current)
            return;
        focusMap.current.set(definition.id, ref.current);
        return () => {
            focusMap.current.delete(definition.id);
        };
    }, [definition.id, focusMap]);
    const handleClick = () => {
        const element = ref.current;
        const contextWithFocus = { ...context, returnFocus: element };
        definition.run(contextWithFocus);
        definition.analytics?.(contextWithFocus);
    };
    const disabled = !canExecute || state.disabled;
    const loading = Boolean(state.loading);
    const Icon = definition.icon;
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { ref: ref, id: getPrimaryCommandAnchorId(definition.id), type: "button", variant: definition.intent === 'primary' ? 'default' : 'outline', className: cn(ACTION_BUTTON_CLASSES, definition.intent === 'primary'
                        ? 'bg-[color:var(--accent-inbox-primary)] text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]'
                        : 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong'), onClick: handleClick, disabled: disabled || loading, "aria-disabled": disabled || loading, "aria-label": `${definition.label}${definition.shortcutDisplay ? ` (${definition.shortcutDisplay})` : ''}`, children: [loading ? (_jsx("span", { className: "size-4 rounded-full border-2 border-current border-t-transparent animate-spin" })) : null, !loading && Icon ? (_jsx(Icon, { className: cn('size-5 shrink-0', definition.intent === 'primary' ? 'text-white' : 'text-foreground'), "aria-hidden": true })) : null, _jsx("span", { className: "sr-only", children: definition.label })] }) }), _jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: definition.label }), definition.shortcutDisplay ? (_jsx("span", { className: "rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: definition.shortcutDisplay })) : null] }) })] }));
};
const CommandMenuButton = ({ entry, context, focusMap }) => {
    const { definition, canExecute } = entry;
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!triggerRef.current)
            return;
        focusMap.current.set(definition.id, triggerRef.current);
        return () => focusMap.current.delete(definition.id);
    }, [definition.id, focusMap]);
    const runItem = (item) => {
        const element = triggerRef.current;
        const contextWithFocus = { ...context, returnFocus: element };
        item.run(contextWithFocus);
        item.analytics?.(contextWithFocus);
    };
    const Icon = definition.icon;
    return (_jsxs(Tooltip, { children: [_jsxs(DropdownMenu, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { ref: triggerRef, id: getPrimaryCommandAnchorId(definition.id), type: "button", variant: "outline", className: cn(ACTION_BUTTON_CLASSES, 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong'), disabled: !canExecute, "aria-label": definition.label, children: [Icon ? _jsx(Icon, { className: "size-5 shrink-0 text-foreground", "aria-hidden": true }) : null, _jsx("span", { className: "sr-only", children: definition.label })] }) }) }), _jsx(DropdownMenuContent, { align: "end", sideOffset: 6, className: "w-48", children: definition.menuItems.map((item) => {
                            const itemCanExecute = item.canExecute?.(context) ?? true;
                            return (_jsx(DropdownMenuItem, { disabled: !itemCanExecute, onSelect: (event) => {
                                    if (!itemCanExecute) {
                                        event.preventDefault();
                                        return;
                                    }
                                    runItem(item);
                                }, children: item.label }, item.id));
                        }) })] }), _jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: definition.label })] }));
};
const CommandOverflow = ({ secondary, context, focusMap }) => {
    const triggerRef = useRef(null);
    useEffect(() => {
        const trigger = triggerRef.current;
        if (!trigger) {
            return;
        }
        secondary.forEach((entry) => {
            focusMap.current.set(entry.definition.id, trigger);
        });
        return () => {
            secondary.forEach((entry) => {
                focusMap.current.delete(entry.definition.id);
            });
        };
    }, [focusMap, secondary]);
    const handleSelect = useCallback((definition, runAction, analytics) => {
        const element = focusMap.current.get(definition.id) ?? triggerRef.current ?? null;
        const contextWithFocus = { ...context, returnFocus: element };
        runAction(contextWithFocus);
        analytics?.(contextWithFocus);
    }, [context, focusMap]);
    if (secondary.length === 0) {
        return null;
    }
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { ref: triggerRef, type: "button", variant: "outline", className: cn(ACTION_BUTTON_CLASSES, 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong'), "aria-label": "Mais a\u00E7\u00F5es", children: _jsx(Ellipsis, { className: "size-5", "aria-hidden": true }) }) }), _jsx(DropdownMenuContent, { align: "end", sideOffset: 6, className: "w-56", children: secondary.map((entry) => {
                    const { definition, canExecute, state } = entry;
                    if (definition.type === 'menu') {
                        const MenuIcon = definition.icon;
                        return (_jsxs(DropdownMenuSub, { children: [_jsxs(DropdownMenuSubTrigger, { id: getPrimaryCommandAnchorId(definition.id), disabled: !canExecute, className: "flex w-full items-center gap-2", children: [MenuIcon ? _jsx(MenuIcon, { className: "size-4 shrink-0 text-foreground", "aria-hidden": true }) : null, _jsx("span", { className: "flex-1 truncate", children: definition.label })] }), _jsx(DropdownMenuSubContent, { className: "w-56", children: definition.menuItems.map((item) => {
                                        const itemCanExecute = item.canExecute?.(context) ?? true;
                                        return (_jsx(DropdownMenuItem, { disabled: !itemCanExecute, onSelect: (event) => {
                                                if (!itemCanExecute) {
                                                    event.preventDefault();
                                                    return;
                                                }
                                                handleSelect(definition, item.run, item.analytics);
                                            }, children: item.label }, item.id));
                                    }) })] }, definition.id));
                    }
                    const Icon = definition.icon;
                    return (_jsxs(DropdownMenuItem, { id: getPrimaryCommandAnchorId(definition.id), disabled: !canExecute || state.disabled, onSelect: (event) => {
                            if (!canExecute || state.disabled) {
                                event.preventDefault();
                                return;
                            }
                            handleSelect(definition, definition.run, definition.analytics);
                        }, children: [Icon ? _jsx(Icon, { className: "mr-2 size-4 shrink-0 text-foreground", "aria-hidden": true }) : null, _jsx("span", { className: "flex-1 truncate", children: definition.label }), definition.shortcutDisplay ? (_jsx("span", { className: "rounded-md bg-surface-overlay-quiet px-1.5 py-0.5 text-[10px] text-foreground-muted", children: definition.shortcutDisplay })) : null] }, definition.id));
                }) })] }));
};
const CommandBar = ({ context, className }) => {
    const focusMap = useRef(new Map());
    const resolvedActions = useMemo(() => normalizeActions(context), [context]);
    const { primary, secondary } = useMemo(() => groupActions(resolvedActions), [resolvedActions]);
    const commandIds = useMemo(() => Array.from(new Set(resolvedActions.map((entry) => entry.definition.id))), [resolvedActions]);
    useSlashShortcuts(resolvedActions, context, focusMap);
    return (_jsxs(_Fragment, { children: [commandIds.map((actionId) => (_jsx(CommandAnchorMarkers, { actionId: actionId, focusMap: focusMap }, actionId))), _jsxs("div", { className: cn('flex w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/80 px-3 py-2 backdrop-blur lg:flex-nowrap', className), role: "toolbar", "aria-label": "A\u00E7\u00F5es do atendimento", children: [primary.map((entry) => {
                        if (entry.definition.id === 'assign-owner') {
                            return (_jsx(AssignTicketPopover, { entry: entry, context: context, focusMap: focusMap, buttonClassName: ACTION_BUTTON_CLASSES }, entry.definition.id));
                        }
                        if (entry.definition.type === 'menu') {
                            return (_jsx(CommandMenuButton, { entry: entry, context: context, focusMap: focusMap }, entry.definition.id));
                        }
                        return (_jsx(CommandButton, { entry: entry, context: context, focusMap: focusMap }, entry.definition.id));
                    }), _jsx("div", { className: "flex flex-1 justify-end", children: _jsx(CommandOverflow, { secondary: secondary, context: context, focusMap: focusMap }) })] })] }));
};
const CommandAnchorMarkers = ({ actionId, focusMap }) => {
    const handleFocus = useCallback(() => {
        const target = focusMap.current.get(actionId);
        if (target && typeof target.focus === 'function') {
            target.focus({ preventScroll: true });
        }
    }, [actionId, focusMap]);
    return getAllAnchorIdsForCommand(actionId).map((anchorId) => (_jsx("span", { id: anchorId, tabIndex: -1, onFocus: handleFocus, "aria-hidden": "true", className: "sr-only", "data-command-anchor": actionId }, anchorId)));
};
export { CommandBar };
