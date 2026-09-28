import React, { useState, useEffect } from 'react'
import { Plus, X, Check, Eye } from 'lucide-react'
import type { Column as ColumnType, Task } from '../types/kanban'
import { Column } from './Column'

interface BoardProps {
  columns: ColumnType[]
  tasks: Task[]
  hiddenColumnIds?: string[]
  onHideColumn?: (columnId: string) => void
  onShowColumn?: (columnId: string) => void
  onNewTaskInColumn: (columnId: string) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onMoveTask: (taskId: string, targetColumnId: string, targetIndex?: number) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  onStartFocus: (taskId: string, taskTitle: string) => void
  onAddColumn: (title: string, colorTheme: ColumnType['colorTheme']) => void
  onDeleteColumn?: (columnId: string) => void
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void
  onReorderColumns?: (newColumns: ColumnType[]) => void
  onUpdateColumn?: (
    columnId: string,
    updates: { title?: string; colorTheme?: ColumnType['colorTheme'] }
  ) => void
  focusedTaskId?: string | null
}

const columnThemes: Record<
  ColumnType['colorTheme'],
  { dotColor: string; badgeClass: string }
> = {
  blue: {
    dotColor: 'bg-blue-600',
    badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
  amber: {
    dotColor: 'bg-amber-500',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
  },
  purple: {
    dotColor: 'bg-purple-500',
    badgeClass:
      'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
  },
  emerald: {
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
  rose: {
    dotColor: 'bg-rose-500',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
  },
  slate: {
    dotColor: 'bg-slate-400 dark:bg-slate-500',
    badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  },
}

export const Board: React.FC<BoardProps> = ({
  columns,
  tasks,
  hiddenColumnIds = [],
  onHideColumn,
  onShowColumn,
  onNewTaskInColumn,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  onToggleSubtask,
  onStartFocus,
  onAddColumn,
  onDeleteColumn,
  onMoveColumn,
  onReorderColumns,
  onUpdateColumn,
  focusedTaskId,
}) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<ColumnType['colorTheme']>('blue')
  const [activeDragOverColumnId, setActiveDragOverColumnId] = useState<string | null>(
    null
  )

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setActiveDragOverColumnId(null)
    }
    window.addEventListener('dragend', handleGlobalDragEnd)
    return () => window.removeEventListener('dragend', handleGlobalDragEnd)
  }, [])

  const themes: {
    id: ColumnType['colorTheme']
    label: string
    colorClass: string
    ringClass: string
  }[] = [
    {
      id: 'blue',
      label: 'Azul',
      colorClass: 'bg-blue-500',
      ringClass: 'ring-blue-400',
    },
    {
      id: 'amber',
      label: 'Âmbar',
      colorClass: 'bg-amber-500',
      ringClass: 'ring-amber-400',
    },
    {
      id: 'purple',
      label: 'Roxo',
      colorClass: 'bg-purple-500',
      ringClass: 'ring-purple-400',
    },
    {
      id: 'emerald',
      label: 'Esmeralda',
      colorClass: 'bg-emerald-500',
      ringClass: 'ring-emerald-400',
    },
    {
      id: 'rose',
      label: 'Rosa',
      colorClass: 'bg-rose-500',
      ringClass: 'ring-rose-400',
    },
    {
      id: 'slate',
      label: 'Neutro',
      colorClass: 'bg-slate-500',
      ringClass: 'ring-slate-400',
    },
  ]

  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColumnTitle.trim()) return

    onAddColumn(newColumnTitle.trim(), selectedTheme)
    setNewColumnTitle('')
    setSelectedTheme('blue')
    setIsAddingColumn(false)
  }

  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const visibleColumns = columns.filter((col) => !hiddenColumnIds.includes(col.id))
  const activeColumnId =
    selectedColumnId && visibleColumns.some((c) => c.id === selectedColumnId)
      ? selectedColumnId
      : visibleColumns[0]?.id || ''

  const scrollToColumn = (columnId: string) => {
    setSelectedColumnId(columnId)
    if (typeof document === 'undefined') return
    const el = document.getElementById(`column-${columnId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }

  return (
    <div className="w-full">
      {/* Mobile Column Navigation Segmented Control */}
      <nav
        aria-label="Navegação rápida de colunas"
        className={`grid gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 sm:hidden mb-3 w-full no-scrollbar ${
          visibleColumns.length <= 3
            ? 'grid-cols-3'
            : 'grid-flow-col auto-cols-[minmax(110px,1fr)] overflow-x-auto'
        }`}
      >
        {visibleColumns.map((col) => {
          const colTasks = tasks.filter((t) => t.columnId === col.id)
          const isActive = col.id === activeColumnId
          return (
            <button
              key={col.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-all cursor-pointer min-h-[36px] overflow-hidden ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs ring-1 ring-slate-900/5 dark:ring-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              aria-label={`Ir para coluna ${col.title}`}
            >
              <span className="truncate">
                {col.title} ({colTasks.length})
              </span>
            </button>
          )
        })}
      </nav>

      {/* Horizontal Scroll Columns Area matching Stitch gap-5 items-start */}
      <div
        className="flex items-start gap-5 overflow-x-auto pb-6 pt-1 px-0.5 scroll-smooth snap-x snap-mandatory"
        onDragLeave={(e) => {
          if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setActiveDragOverColumnId(null)
          }
        }}
      >
        {columns.map((column) => {
          const colTasks = tasks.filter((t) => t.columnId === column.id)
          const isHidden = hiddenColumnIds.includes(column.id)

          if (isHidden) {
            const currentTheme = columnThemes[column.colorTheme] || columnThemes.slate
            return (
              <div
                key={column.id}
                id={`column-collapsed-${column.id}`}
                data-testid={`column-collapsed-${column.id}`}
                className="shrink-0 w-12 min-w-[48px] min-h-[460px] rounded-2xl bg-slate-100/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-4 px-1 select-none transition-all duration-200 group"
              >
                {/* Top: Dot indicator + Task count badge */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentTheme.dotColor}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${currentTheme.badgeClass}`}
                    title={`${colTasks.length} tarefas`}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Center: Eye button to restore */}
                <div className="my-auto">
                  <button
                    type="button"
                    onClick={() => onShowColumn && onShowColumn(column.id)}
                    title={`Reexibir coluna ${column.title}`}
                    aria-label={`Reexibir coluna ${column.title}`}
                    className="p-2 rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom: Vertical Title */}
                <div className="mt-auto pt-4 [writing-mode:vertical-rl] rotate-180 flex items-center justify-center">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-tight whitespace-nowrap">
                    {column.title}
                  </span>
                </div>
              </div>
            )
          }

          return (
            <Column
              key={column.id}
              column={column}
              allColumns={columns}
              tasks={colTasks}
              onNewTaskInColumn={onNewTaskInColumn}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onMoveTask={(taskId, targetColId) => {
                setActiveDragOverColumnId(null)
                onMoveTask(taskId, targetColId)
              }}
              onToggleSubtask={onToggleSubtask}
              onStartFocus={onStartFocus}
              onDeleteColumn={onDeleteColumn}
              onMoveColumn={onMoveColumn}
              onReorderColumns={onReorderColumns}
              onUpdateColumn={onUpdateColumn}
              onHideColumn={onHideColumn}
              focusedTaskId={focusedTaskId}
              isDragOver={activeDragOverColumnId === column.id}
              onDragOverColumn={(colId: string | null) =>
                setActiveDragOverColumnId(colId)
              }
            />
          )
        })}

        {/* Add Column Section */}
        <div className="shrink-0 w-72">
          {isAddingColumn ? (
            <form
              onSubmit={handleCreateColumn}
              className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nova Coluna
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title input */}
              <input
                type="text"
                autoFocus
                placeholder="Nome da coluna..."
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-3"
              />

              {/* Color theme selection */}
              <div className="mb-4">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Tema de Cor
                </label>
                <div className="flex items-center justify-between gap-1">
                  {themes.map((t) => {
                    const isSelected = selectedTheme === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTheme(t.id)}
                        title={t.label}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          t.colorClass
                        } ${
                          isSelected
                            ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${t.ringClass} scale-105`
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="flex-1 py-1.5 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newColumnTitle.trim()}
                  className="flex-1 py-1.5 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl shadow-xs shadow-blue-500/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Criar Coluna
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-full min-h-[120px] rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center justify-center gap-2 transition-all duration-150 group cursor-pointer bg-slate-50/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 group-hover:text-blue-600 flex items-center justify-center shadow-xs transition-colors">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium tracking-tight">Adicionar Coluna</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
