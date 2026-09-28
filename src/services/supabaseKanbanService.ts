import { supabase } from '../lib/supabase'
import {
  DEFAULT_COLUMN_IDS,
  type Column,
  type Task,
  type Priority,
} from '../types/kanban'
import { DEFAULT_COLUMNS } from './seedData'

export async function fetchKanbanData(
  userId: string
): Promise<{ columns: Column[]; tasks: Task[] }> {
  const [columnsRes, tasksRes] = await Promise.all([
    supabase
      .from('kanban_columns')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true }),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  if (columnsRes.error) {
    console.error('Erro ao buscar colunas do Kanban no Supabase:', columnsRes.error)
    throw columnsRes.error
  }

  if (tasksRes.error) {
    console.error('Erro ao buscar tarefas do Kanban no Supabase:', tasksRes.error)
    throw tasksRes.error
  }

  const columns: Column[] = (columnsRes.data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    order: row.order ?? 0,
    colorTheme: (row.color_theme || row.color || 'blue') as Column['colorTheme'],
  }))

  const tasks: Task[] = (tasksRes.data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    columnId: row.column_id,
    priority: (row.priority as Priority) || 'medium',
    tags: Array.isArray(row.tags) ? row.tags : [],
    dueDate: row.due_date || undefined,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    completedAt:
      row.completed_at ||
      (row.column_id === 'col-done' || row.column_id?.includes('done')
        ? row.updated_at
        : undefined),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    pomodoroMinutesSpent: row.pomodoro_minutes_spent ?? 0,
  }))

  return { columns, tasks }
}

export async function syncColumns(userId: string, columns: Column[]): Promise<void> {
  if (columns.length === 0) return

  const rows = columns.map((col, idx) => ({
    id: col.id,
    user_id: userId,
    title: col.title,
    color_theme: col.colorTheme,
    order: col.order ?? idx,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('kanban_columns').upsert(rows, {
    onConflict: 'id,user_id',
  })

  if (error) {
    console.error('Erro ao sincronizar colunas no Supabase:', error)
    throw error
  }
}

export async function ensureDefaultColumns(userId: string): Promise<void> {
  await syncColumns(userId, DEFAULT_COLUMNS)
}

export async function syncTask(userId: string, task: Task): Promise<void> {
  const row = {
    id: task.id,
    user_id: userId,
    column_id: task.columnId,
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    due_date: task.dueDate ?? null,
    pomodoro_minutes_spent: task.pomodoroMinutesSpent ?? 0,
    subtasks: task.subtasks ?? [],
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }

  const { error } = await supabase.from('tasks').upsert(row, {
    onConflict: 'id,user_id',
  })

  if (error) {
    const isForeignKeyViolation =
      (error as any).code === '23503' ||
      (typeof error.message === 'string' &&
        (error.message.toLowerCase().includes('foreign key') ||
          error.message.toLowerCase().includes('kanban_columns'))) ||
      (typeof (error as any).details === 'string' &&
        ((error as any).details.toLowerCase().includes('foreign key') ||
          (error as any).details.toLowerCase().includes('kanban_columns')))

    if (isForeignKeyViolation) {
      await ensureDefaultColumns(userId)
      const { error: retryError } = await supabase.from('tasks').upsert(row, {
        onConflict: 'id,user_id',
      })
      if (retryError) {
        console.error(
          'Erro ao sincronizar tarefa no Supabase após garantir colunas:',
          retryError
        )
        throw retryError
      }
      return
    }

    console.error('Erro ao sincronizar tarefa no Supabase:', error)
    throw error
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    console.error('Erro ao deletar tarefa no Supabase:', error)
    throw error
  }
}

export async function deleteColumn(columnId: string): Promise<void> {
  if (DEFAULT_COLUMN_IDS.includes(columnId as any)) {
    throw new Error('Colunas padrão não podem ser excluídas')
  }
  // Deleção em cascata nativa do PostgreSQL (ACID: Atomicidade e Consistência)
  // A exclusão da coluna aciona a remoção em cascata de todas as tarefas associadas via fk_tasks_kanban_columns
  const { error } = await supabase.from('kanban_columns').delete().eq('id', columnId)
  if (error) {
    console.error('Erro ao deletar coluna no Supabase:', error)
    throw error
  }
}

export async function uploadLocalData(
  userId: string,
  columns: Column[],
  tasks: Task[]
): Promise<void> {
  const columnsToSync = columns.length > 0 ? columns : DEFAULT_COLUMNS
  await syncColumns(userId, columnsToSync)

  if (tasks.length > 0) {
    const taskRows = tasks.map((task) => ({
      id: task.id,
      user_id: userId,
      column_id: task.columnId,
      title: task.title,
      description: task.description ?? null,
      priority: task.priority,
      due_date: task.dueDate ?? null,
      pomodoro_minutes_spent: task.pomodoroMinutesSpent ?? 0,
      subtasks: task.subtasks ?? [],
      completed_at: task.completedAt ?? null,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    }))

    const { error } = await supabase.from('tasks').upsert(taskRows, {
      onConflict: 'id,user_id',
    })

    if (error) {
      console.error('Erro ao fazer upload de tarefas locais para o Supabase:', error)
      throw error
    }
  }
}

export const supabaseKanbanService = {
  fetchKanbanData,
  syncColumns,
  ensureDefaultColumns,
  syncTask,
  deleteTask,
  deleteColumn,
  uploadLocalData,
}
