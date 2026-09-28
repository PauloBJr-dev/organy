import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Check,
  X,
  GripVertical,
  EyeOff,
} from 'lucide-react'
import { DEFAULT_COLUMN_IDS, type Column as ColumnType, type Task } from '../types/kanban'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  column: ColumnType
  allColumns: ColumnType[]
  tasks: Task[]
  onNewTaskInColumn: (columnId: string) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onMoveTask: (taskId: string, targetColumnId: string) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  onStartFocus: (taskId: string, taskTitle: string) => void
  onDeleteColumn?: (columnId: string) => void
  onMoveColumn?: (columnId: string, direction: 'left' | 'right') => void
  onReorderColumns?: (newColumns: ColumnType[]) => void
  onUpdateColumn?: (
    columnId: string,
    updates: { title?: string; colorTheme?: ColumnType['colorTheme'] }
  ) => void
  onHideColumn?: (columnId: string) => void
  focusedTaskId?: string | null
  isDragOver?: boolean
  onDragOverColumn?: (columnId: string | null) => void
}

export const Column: React.FC<ColumnProps> = ({
  column,
  allColumns,
  tasks,
  onNewTaskInColumn,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  onToggleSubtask,
  onStartFocus,
  onDeleteColumn,
  onMoveColumn,
  onReorderColumns,
  onUpdateColumn,
  onHideColumn,
  focusedTaskId,
  isDragOver: isDragOverProp,
  onDragOverColumn,
}) => {
  const [internalIsDragOver, setInternalIsDragOver] = useState(false)
  const isDragOver = isDragOverProp !== undefined ? isDragOverProp : internalIsDragOver
  const [columnDragPosition, setColumnDragPosition] = useState<'left' | 'right' | null>(
    null
  )

  // Inline column editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)
  const [editTheme, setEditTheme] = useState<ColumnType['colorTheme']>(column.colorTheme)

  // Column position in board
  const colIndex = allColumns.findIndex((c) => c.id === column.id)
  const canMoveLeft = colIndex > 0
  const canMoveRight = colIndex !== -1 && colIndex < allColumns.length - 1

  const availableThemes: {
    id: ColumnType['colorTheme']
    label: string
    colorClass: string
  }[] = [
    { id: 'blue', label: 'Azul', colorClass: 'bg-blue-500' },
    { id: 'amber', label: 'Âmbar', colorClass: 'bg-amber-500' },
    { id: 'purple', label: 'Roxo', colorClass: 'bg-purple-500' },
    { id: 'emerald', label: 'Esmeralda', colorClass: 'bg-emerald-500' },
    { id: 'rose', label: 'Rosa', colorClass: 'bg-rose-500' },
    { id: 'slate', label: 'Neutro', colorClass: 'bg-slate-500' },
  ]

  // Header styles per column theme aligned with Stitch specifications
  const themeConfig: Record<
    ColumnType['colorTheme'],
    {
      dotColor: string
      badgeClass: string
      dropHighlight: string
      isPulse?: boolean
    }
  > = {
    blue: {
      dotColor: 'bg-blue-600',
      badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      dropHighlight:
        'border-blue-400 bg-blue-50/20 dark:bg-blue-950/20 ring-2 ring-blue-400/30',
    },
    amber: {
      dotColor: 'bg-amber-500',
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
      dropHighlight:
        'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20 ring-2 ring-amber-400/30',
      isPulse: true,
    },
    purple: {
      dotColor: 'bg-purple-500',
      badgeClass:
        'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
      dropHighlight:
        'border-purple-400 bg-purple-50/20 dark:bg-purple-950/20 ring-2 ring-purple-400/30',
    },
    emerald: {
      dotColor: 'bg-emerald-500',
      badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      dropHighlight:
        'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-400/30',
    },
    rose: {
      dotColor: 'bg-rose-500',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      dropHighlight:
        'border-rose-400 bg-rose-50/20 dark:bg-rose-950/20 ring-2 ring-rose-400/30',
    },
    slate: {
      dotColor: 'bg-slate-400 dark:bg-slate-500',
      badgeClass: 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      dropHighlight:
        'border-slate-400 bg-slate-100/30 dark:bg-slate-800/30 ring-2 ring-slate-400/30',
    },
  }

  const currentTheme = themeConfig[column.colorTheme] || themeConfig.slate

  // Save inline column edit
  const handleSaveColumn = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editTitle.trim()) return
    if (onUpdateColumn) {
      onUpdateColumn(column.id, {
        title: editTitle.trim(),
        colorTheme: editTheme,
      })
    }
    setIsEditing(false)
  }

  const handleCancelColumn = () => {
    setEditTitle(column.title)
    setEditTheme(column.colorTheme)
    setIsEditing(false)
  }

  // Column header drag start
  const handleColumnDragStart = (e: React.DragEvent) => {
    if (isEditing) return
    e.dataTransfer.setData('text/kanban-column-id', column.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const isColDrag = e.dataTransfer?.types
      ? Array.from(e.dataTransfer.types).includes('text/kanban-column-id')
      : false

    if (!isColDrag) {
      if (onDragOverColumn) {
        onDragOverColumn(column.id)
      } else {
        setInternalIsDragOver(true)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }

    const isColDrag = e.dataTransfer?.types
      ? Array.from(e.dataTransfer.types).includes('text/kanban-column-id')
      : false

    if (isColDrag) {
      const rect = e.currentTarget.getBoundingClientRect()
      const isRight = rect.width > 0 ? e.clientX - rect.left > rect.width / 2 : false
      setColumnDragPosition(isRight ? 'right' : 'left')
    } else {
      if (onDragOverColumn) {
        onDragOverColumn(column.id)
      } else {
        setInternalIsDragOver(true)
      }
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }

    if (onDragOverColumn) {
      onDragOverColumn(null)
    } else {
      setInternalIsDragOver(false)
    }
    setColumnDragPosition(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (onDragOverColumn) {
      onDragOverColumn(null)
    } else {
      setInternalIsDragOver(false)
    }

    const sourceColId = e.dataTransfer?.getData('text/kanban-column-id')
    if (sourceColId && onReorderColumns) {
      const dropPos = columnDragPosition
      setColumnDragPosition(null)
      if (sourceColId !== column.id) {
        const sourceIndex = allColumns.findIndex((c) => c.id === sourceColId)
        const targetIndex = allColumns.findIndex((c) => c.id === column.id)
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newCols = [...allColumns]
          const [moved] = newCols.splice(sourceIndex, 1)
          let insertIndex = newCols.findIndex((c) => c.id === column.id)
          if (dropPos === 'right') {
            insertIndex += 1
          }
          newCols.splice(insertIndex, 0, moved)
          onReorderColumns(newCols)
        }
      }
      return
    }

    setColumnDragPosition(null)
    const taskId = e.dataTransfer?.getData('text/plain')
    if (taskId) {
      onMoveTask(taskId, column.id)
    }
  }

  return (
    <div
      id={`column-${column.id}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="region"
      aria-label={`Coluna ${column.title}`}
      className={`relative flex flex-col shrink-0 w-[86vw] max-w-[340px] sm:w-80 sm:max-w-sm rounded-2xl p-3.5 sm:p-4 snap-center transition-all duration-200 ${
        isDragOver
          ? `${currentTheme.dropHighlight} scale-[1.01]`
          : 'bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5'
      }`}
    >
      {/* Visual Drop Indicators for Column Reordering */}
      {columnDragPosition === 'left' && (
        <div
          data-testid="column-drop-left"
          className="absolute -left-1 top-2 bottom-2 w-1.5 bg-blue-500 rounded-full z-30 pointer-events-none shadow-sm shadow-blue-500/50 animate-pulse"
        />
      )}
      {columnDragPosition === 'right' && (
        <div
          data-testid="column-drop-right"
          className="absolute -right-1 top-2 bottom-2 w-1.5 bg-blue-500 rounded-full z-30 pointer-events-none shadow-sm shadow-blue-500/50 animate-pulse"
        />
      )}

      {/* Column Header */}
      {isEditing ? (
        <div className="p-2.5 mb-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <input
            type="text"
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveColumn()
              if (e.key === 'Escape') handleCancelColumn()
            }}
            placeholder="Nome da coluna..."
            aria-label="Nome da coluna"
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 mb-2"
          />

          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[10px] font-medium text-slate-400">Tema:</span>
            <div className="flex items-center gap-1">
              {availableThemes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditTheme(t.id)}
                  title={t.label}
                  aria-label={t.label}
                  className={`w-4 h-4 rounded-full transition-transform ${t.colorClass} ${
                    editTheme === t.id
                      ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-800 ring-slate-800 dark:ring-slate-200 scale-110'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleCancelColumn}
              title="Cancelar edição"
              aria-label="Cancelar edição da coluna"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleSaveColumn()}
              disabled={!editTitle.trim()}
              title="Salvar alterações"
              aria-label="Salvar alterações da coluna"
              className="p-1 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          draggable={!isEditing}
          onDragStart={handleColumnDragStart}
          className="flex items-center justify-between px-1 py-1 select-none cursor-grab active:cursor-grabbing group/header"
        >
          {/* Left indicator dot + Title + Counter badge */}
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0" />
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentTheme.dotColor} ${
                currentTheme.isPulse ? 'animate-pulse' : ''
              }`}
            />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {column.title}
            </h2>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${currentTheme.badgeClass}`}
            >
              {tasks.length}
            </span>
          </div>

          {/* Right Action Buttons */}
          <div
            className="flex items-center gap-0.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Move column left button */}
            {canMoveLeft && onMoveColumn && (
              <button
                type="button"
                onClick={() => onMoveColumn(column.id, 'left')}
                title="Mover coluna para esquerda"
                aria-label={`Mover coluna ${column.title} para a esquerda`}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Move column right button */}
            {canMoveRight && onMoveColumn && (
              <button
                type="button"
                onClick={() => onMoveColumn(column.id, 'right')}
                title="Mover coluna para direita"
                aria-label={`Mover coluna ${column.title} para a direita`}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit column title & theme */}
            {onUpdateColumn &&
              !column.isPermanent &&
              !DEFAULT_COLUMN_IDS.includes(column.id as any) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(column.title)
                    setEditTheme(column.colorTheme)
                    setIsEditing(true)
                  }}
                  title="Editar coluna"
                  aria-label={`Editar coluna ${column.title}`}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

            {/* Hide column button */}
            {onHideColumn && (
              <button
                type="button"
                onClick={() => onHideColumn(column.id)}
                title={`Ocultar coluna ${column.title}`}
                aria-label={`Ocultar coluna ${column.title}`}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick add button in header */}
            <button
              type="button"
              onClick={() => onNewTaskInColumn(column.id)}
              title="Adicionar tarefa nesta coluna"
              aria-label={`Adicionar tarefa na coluna ${column.title}`}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Delete column button (only if NOT permanent and > 2 columns) */}
            {!column.isPermanent &&
              !DEFAULT_COLUMN_IDS.includes(column.id as any) &&
              allColumns.length > 2 &&
              onDeleteColumn && (
                <button
                  type="button"
                  onClick={() => onDeleteColumn(column.id)}
                  title="Excluir coluna"
                  aria-label={`Excluir coluna ${column.title}`}
                  className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
          </div>
        </div>
      )}

      {/* Task Cards Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-[140px] overflow-y-auto p-0.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            columns={allColumns}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onMove={onMoveTask}
            onToggleSubtask={onToggleSubtask}
            onStartFocus={onStartFocus}
            isFocused={focusedTaskId === task.id}
          />
        ))}

        {/* Drop zone placeholder indicator when dragging task over column */}
        {isDragOver && (
          <div
            data-testid="drop-indicator"
            className="pointer-events-none py-3 px-4 border-2 border-dashed border-blue-400 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-400/20 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 select-none transition-all duration-200 shadow-xs"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Solte para mover para {column.title}</span>
          </div>
        )}

        {/* Empty state hint */}
        {tasks.length === 0 && !isDragOver && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200/70 dark:border-slate-800/80 rounded-xl text-center select-none">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              Nenhuma tarefa aqui
            </p>
            <button
              type="button"
              onClick={() => onNewTaskInColumn(column.id)}
              aria-label={`Adicionar primeira tarefa na coluna ${column.title}`}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
        )}
      </div>

      {/* Bottom Add button matching Stitch */}
      <button
        type="button"
        onClick={() => onNewTaskInColumn(column.id)}
        aria-label={`Adicionar tarefa na coluna ${column.title}`}
        className="w-full py-2 border border-dashed border-slate-300/80 dark:border-slate-700 hover:border-blue-500 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl flex items-center justify-center gap-1 transition-colors mt-auto cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Adicionar Tarefa</span>
      </button>
    </div>
  )
}
