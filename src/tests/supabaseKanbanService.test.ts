import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabase'
import {
  fetchKanbanData,
  syncColumns,
  ensureDefaultColumns,
  syncTask,
  deleteTask,
  deleteColumn,
  uploadLocalData,
  supabaseKanbanService,
} from '../services/supabaseKanbanService'
import type { Column, Task } from '../types/kanban'

describe('supabaseKanbanService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchKanbanData', () => {
    it('busca e mapeia colunas e tarefas do Supabase com sucesso ordenando tarefas por created_at', async () => {
      const mockColumnsData = [
        {
          id: 'col-1',
          user_id: 'user-abc',
          title: 'A Fazer',
          order: 0,
          color_theme: 'blue',
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        },
      ]

      const mockTasksData = [
        {
          id: 'task-1',
          user_id: 'user-abc',
          column_id: 'col-1',
          title: 'Implementar Testes',
          description: 'Cobrir 100% dos serviços',
          priority: 'high',
          due_date: '2026-09-10',
          subtasks: [{ id: 'sub-1', title: 'Unitário', completed: false }],
          pomodoro_minutes_spent: 25,
          completed_at: '2026-09-05T12:00:00.000Z',
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        },
      ]

      const taskOrderSpy = vi.fn().mockResolvedValue({ data: mockTasksData, error: null })
      const columnOrderSpy = vi
        .fn()
        .mockResolvedValue({ data: mockColumnsData, error: null })

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'kanban_columns') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: columnOrderSpy,
          } as any
        }
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: taskOrderSpy,
          } as any
        }
        return {} as any
      })

      const result = await fetchKanbanData('user-abc')

      // Garante que a ordenação de tarefas foi feita por 'created_at' e não por 'order'
      expect(taskOrderSpy).toHaveBeenCalledWith('created_at', { ascending: true })

      expect(result.columns).toHaveLength(1)
      expect(result.columns[0]).toEqual({
        id: 'col-1',
        title: 'A Fazer',
        order: 0,
        colorTheme: 'blue',
      })

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0]).toEqual({
        id: 'task-1',
        title: 'Implementar Testes',
        description: 'Cobrir 100% dos serviços',
        columnId: 'col-1',
        priority: 'high',
        tags: [],
        dueDate: '2026-09-10',
        subtasks: [{ id: 'sub-1', title: 'Unitário', completed: false }],
        completedAt: '2026-09-05T12:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        pomodoroMinutesSpent: 25,
      })
    })

    it('lança erro quando busca de colunas falha', async () => {
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Falha no banco de dados'),
        }),
      } as any)

      await expect(fetchKanbanData('user-abc')).rejects.toThrow('Falha no banco de dados')
    })
  })

  describe('syncColumns', () => {
    it('faz upsert das colunas com color_theme e sem coluna color', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const columns: Column[] = [
        { id: 'col-todo', title: 'A Fazer', order: 0, colorTheme: 'blue' },
      ]

      await syncColumns('user-abc', columns)

      expect(upsertMock).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 'col-todo',
            user_id: 'user-abc',
            title: 'A Fazer',
            color_theme: 'blue',
            order: 0,
          }),
        ],
        { onConflict: 'id,user_id' }
      )

      const payload = upsertMock.mock.calls[0][0][0]
      expect(payload).toHaveProperty('color_theme', 'blue')
      expect(payload).not.toHaveProperty('color')
    })

    it('não executa upsert quando array de colunas está vazio', async () => {
      const fromSpy = vi.spyOn(supabase, 'from')
      await syncColumns('user-abc', [])
      expect(fromSpy).not.toHaveBeenCalled()
    })

    it('lança erro quando upsert de colunas falha', async () => {
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: new Error('Erro de RLS') }),
      } as any)

      await expect(
        syncColumns('user-abc', [
          { id: 'col-1', title: 'Teste', order: 0, colorTheme: 'blue' },
        ])
      ).rejects.toThrow('Erro de RLS')
    })
  })

  describe('ensureDefaultColumns', () => {
    it('chama syncColumns com DEFAULT_COLUMNS', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      await ensureDefaultColumns('user-abc')

      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'col-todo', user_id: 'user-abc' }),
          expect.objectContaining({ id: 'col-progress', user_id: 'user-abc' }),
          expect.objectContaining({ id: 'col-review', user_id: 'user-abc' }),
          expect.objectContaining({ id: 'col-done', user_id: 'user-abc' }),
        ]),
        { onConflict: 'id,user_id' }
      )
    })
  })

  describe('syncTask', () => {
    it('faz upsert da tarefa incluindo completed_at e sem campo order', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const task: Task = {
        id: 'task-123',
        title: 'Estudar TypeScript',
        description: 'Tipagem avançada',
        columnId: 'col-todo',
        priority: 'high',
        tags: [],
        subtasks: [],
        completedAt: '2026-09-08T15:30:00.000Z',
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }

      await syncTask('user-abc', task)

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-123',
          user_id: 'user-abc',
          column_id: 'col-todo',
          title: 'Estudar TypeScript',
          priority: 'high',
          completed_at: '2026-09-08T15:30:00.000Z',
        }),
        { onConflict: 'id,user_id' }
      )

      const payload = upsertMock.mock.calls[0][0]
      expect(payload).not.toHaveProperty('order')
      expect(payload.completed_at).toBe('2026-09-08T15:30:00.000Z')
    })

    it('envia completed_at como null quando a tarefa não está concluída', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const task: Task = {
        id: 'task-pending',
        title: 'Pendente',
        columnId: 'col-todo',
        priority: 'low',
        tags: [],
        subtasks: [],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }

      await syncTask('user-abc', task)

      const payload = upsertMock.mock.calls[0][0]
      expect(payload.completed_at).toBeNull()
      expect(payload).not.toHaveProperty('order')
    })

    it('retenta upsert da tarefa com sucesso após erro de chave estrangeira (FK violation 23503)', async () => {
      let callCount = 0
      const upsertMock = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            error: {
              code: '23503',
              message:
                'insert or update on table "tasks" violates foreign key constraint "fk_tasks_kanban_columns"',
            },
          })
        }
        return Promise.resolve({ error: null })
      })

      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const task: Task = {
        id: 'task-fk-retry',
        title: 'Tarefa com FK Retry',
        columnId: 'col-todo',
        priority: 'medium',
        tags: [],
        subtasks: [],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }

      await syncTask('user-abc', task)

      expect(upsertMock).toHaveBeenCalledTimes(3)
    })

    it('lança erro se o retry após erro de FK também falhar', async () => {
      let callCount = 0
      const upsertMock = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            error: {
              code: '23503',
              message: 'violates foreign key constraint',
            },
          })
        }
        if (callCount === 2) {
          return Promise.resolve({ error: null })
        }
        return Promise.resolve({
          error: new Error('Falha no retry'),
        })
      })

      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const task: Task = {
        id: 'task-fk-fail',
        title: 'Falha Retry',
        columnId: 'col-todo',
        priority: 'medium',
        tags: [],
        subtasks: [],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }

      await expect(syncTask('user-abc', task)).rejects.toThrow('Falha no retry')
    })

    it('lança erro quando upsert de tarefa falha', async () => {
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: new Error('Erro ao salvar tarefa') }),
      } as any)

      const task: Task = {
        id: 'task-123',
        title: 'Erro',
        columnId: 'col-todo',
        priority: 'medium',
        tags: [],
        subtasks: [],
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      }

      await expect(syncTask('user-abc', task)).rejects.toThrow('Erro ao salvar tarefa')
    })
  })

  describe('deleteTask & deleteColumn', () => {
    it('deleta tarefa por ID', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: eqMock }),
      } as any)

      await deleteTask('task-123')
      expect(eqMock).toHaveBeenCalledWith('id', 'task-123')
    })

    it('deleta coluna e suas respectivas tarefas', async () => {
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.spyOn(supabase, 'from').mockReturnValue({
        delete: deleteMock,
      } as any)

      await deleteColumn('col-custom')
      expect(deleteMock).toHaveBeenCalled()
    })
  })

  describe('uploadLocalData', () => {
    it('faz upload de colunas e tarefas locais em lote sem order e com completed_at e color_theme', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const columns: Column[] = [
        { id: 'col-1', title: 'Backlog', order: 0, colorTheme: 'blue' },
      ]
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Primeira Tarefa',
          columnId: 'col-1',
          priority: 'low',
          tags: [],
          subtasks: [],
          completedAt: '2026-09-02T10:00:00.000Z',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ]

      await uploadLocalData('user-abc', columns, tasks)
      expect(upsertMock).toHaveBeenCalledTimes(2)

      // Verificar colunas
      const columnsPayload = upsertMock.mock.calls[0][0]
      expect(columnsPayload[0]).toHaveProperty('color_theme', 'blue')
      expect(columnsPayload[0]).not.toHaveProperty('color')

      // Verificar tarefas
      const tasksPayload = upsertMock.mock.calls[1][0]
      expect(tasksPayload[0]).not.toHaveProperty('order')
      expect(tasksPayload[0]).toHaveProperty('completed_at', '2026-09-02T10:00:00.000Z')
    })

    it('usa DEFAULT_COLUMNS quando columns for vazio para garantir sincronização antes das tarefas', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      vi.spyOn(supabase, 'from').mockReturnValue({
        upsert: upsertMock,
      } as any)

      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Primeira Tarefa',
          columnId: 'col-todo',
          priority: 'low',
          tags: [],
          subtasks: [],
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ]

      await uploadLocalData('user-abc', [], tasks)
      expect(upsertMock).toHaveBeenCalledTimes(2)

      const columnsPayload = upsertMock.mock.calls[0][0]
      expect(columnsPayload).toHaveLength(4)
      expect(columnsPayload[0]).toHaveProperty('id', 'col-todo')

      const tasksPayload = upsertMock.mock.calls[1][0]
      expect(tasksPayload).toHaveLength(1)
    })
  })

  it('exporta objeto supabaseKanbanService com todos os métodos', () => {
    expect(supabaseKanbanService.fetchKanbanData).toBeDefined()
    expect(supabaseKanbanService.syncColumns).toBeDefined()
    expect(supabaseKanbanService.ensureDefaultColumns).toBeDefined()
    expect(supabaseKanbanService.syncTask).toBeDefined()
    expect(supabaseKanbanService.deleteTask).toBeDefined()
    expect(supabaseKanbanService.deleteColumn).toBeDefined()
    expect(supabaseKanbanService.uploadLocalData).toBeDefined()
  })
})
