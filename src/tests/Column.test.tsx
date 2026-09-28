import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Column } from '../components/Column'
import type { Column as ColumnType, Task } from '../types/kanban'

describe('Column Component', () => {
  const defaultColumns: ColumnType[] = [
    { id: 'col-todo', title: 'A Fazer', order: 0, colorTheme: 'blue' },
    { id: 'col-progress', title: 'Em Progresso', order: 1, colorTheme: 'amber' },
    { id: 'col-review', title: 'Em Espera', order: 2, colorTheme: 'purple' },
    { id: 'col-done', title: 'Concluído Hoje', order: 3, colorTheme: 'emerald' },
    {
      id: 'col-custom',
      title: 'Coluna Personalizada',
      order: 4,
      colorTheme: 'rose',
      isPermanent: false,
    },
  ]

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Tarefa de Teste 1',
      columnId: 'col-custom',
      priority: 'high',
      tags: ['Test'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const baseProps = {
    allColumns: defaultColumns,
    tasks: mockTasks,
    onNewTaskInColumn: vi.fn(),
    onEditTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onMoveTask: vi.fn(),
    onToggleSubtask: vi.fn(),
    onStartFocus: vi.fn(),
    onDeleteColumn: vi.fn(),
    onMoveColumn: vi.fn(),
    onReorderColumns: vi.fn(),
    onUpdateColumn: vi.fn(),
  }

  it('nunca exibe botão de exclusão nas 4 colunas padrão, mesmo sem isPermanent explícito', () => {
    // 1. col-todo
    const { unmount: unmount1 } = render(
      <Column {...baseProps} column={defaultColumns[0]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Excluir coluna A Fazer')).not.toBeInTheDocument()
    unmount1()

    // 2. col-progress
    const { unmount: unmount2 } = render(
      <Column {...baseProps} column={defaultColumns[1]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Excluir coluna Em Progresso')).not.toBeInTheDocument()
    unmount2()

    // 3. col-review (Em Espera)
    const { unmount: unmount3 } = render(
      <Column {...baseProps} column={defaultColumns[2]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Excluir coluna Em Espera')).not.toBeInTheDocument()
    unmount3()

    // 4. col-done (Concluído Hoje)
    const { unmount: unmount4 } = render(
      <Column {...baseProps} column={defaultColumns[3]} tasks={[]} />
    )
    expect(
      screen.queryByLabelText('Excluir coluna Concluído Hoje')
    ).not.toBeInTheDocument()
    unmount4()
  })

  it('exibe botão de exclusão para colunas customizadas e aciona onDeleteColumn ao clicar', () => {
    const onDeleteColumn = vi.fn()
    render(
      <Column
        {...baseProps}
        column={defaultColumns[4]}
        tasks={mockTasks}
        onDeleteColumn={onDeleteColumn}
      />
    )

    const deleteBtn = screen.getByLabelText('Excluir coluna Coluna Personalizada')
    expect(deleteBtn).toBeInTheDocument()

    fireEvent.click(deleteBtn)
    expect(onDeleteColumn).toHaveBeenCalledWith('col-custom')
  })

  it('permite edição inline de título e tema da coluna', () => {
    const onUpdateColumn = vi.fn()
    render(
      <Column
        {...baseProps}
        column={defaultColumns[4]}
        tasks={mockTasks}
        onUpdateColumn={onUpdateColumn}
      />
    )

    const editBtn = screen.getByLabelText('Editar coluna Coluna Personalizada')
    fireEvent.click(editBtn)

    const input = screen.getByLabelText('Nome da coluna')
    fireEvent.change(input, { target: { value: 'Novo Nome Custom' } })

    const saveBtn = screen.getByLabelText('Salvar alterações da coluna')
    fireEvent.click(saveBtn)

    expect(onUpdateColumn).toHaveBeenCalledWith('col-custom', {
      title: 'Novo Nome Custom',
      colorTheme: 'rose',
    })
  })

  it('nunca exibe botão de edição nas 4 colunas padrão do sistema', () => {
    // 1. col-todo
    const { unmount: u1 } = render(
      <Column {...baseProps} column={defaultColumns[0]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Editar coluna A Fazer')).not.toBeInTheDocument()
    u1()

    // 2. col-progress
    const { unmount: u2 } = render(
      <Column {...baseProps} column={defaultColumns[1]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Editar coluna Em Progresso')).not.toBeInTheDocument()
    u2()

    // 3. col-review
    const { unmount: u3 } = render(
      <Column {...baseProps} column={defaultColumns[2]} tasks={[]} />
    )
    expect(screen.queryByLabelText('Editar coluna Em Espera')).not.toBeInTheDocument()
    u3()

    // 4. col-done
    const { unmount: u4 } = render(
      <Column {...baseProps} column={defaultColumns[3]} tasks={[]} />
    )
    expect(
      screen.queryByLabelText('Editar coluna Concluído Hoje')
    ).not.toBeInTheDocument()
    u4()
  })

  it('exibe indicador de drop com pointer-events-none sem animate-pulse ao arrastar tarefa sobre a coluna', () => {
    render(<Column {...baseProps} column={defaultColumns[0]} tasks={[]} />)

    const columnRegion = screen.getByRole('region', { name: /Coluna A Fazer/i })

    // Dispara dragEnter e dragOver
    fireEvent.dragEnter(columnRegion, {
      dataTransfer: {
        types: ['text/plain'],
        dropEffect: 'move',
      },
    })
    fireEvent.dragOver(columnRegion, {
      dataTransfer: {
        types: ['text/plain'],
        dropEffect: 'move',
      },
    })

    const dropIndicator = screen.getByTestId('drop-indicator')
    expect(dropIndicator).toBeInTheDocument()
    expect(dropIndicator).toHaveTextContent('Solte para mover para A Fazer')
    expect(dropIndicator).toHaveClass('pointer-events-none')
    expect(dropIndicator).not.toHaveClass('animate-pulse')

    // Dispara dragLeave para elemento interno da própria coluna (não deve esconder o indicador)
    const childElement = screen.getByText('A Fazer')
    fireEvent.dragEnter(childElement)
    fireEvent.dragLeave(columnRegion, {
      relatedTarget: childElement,
    })
    expect(screen.getByTestId('drop-indicator')).toBeInTheDocument()

    // Dispara drop com taskId
    fireEvent.drop(columnRegion, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'task-test-drop' : ''),
      },
    })
    expect(baseProps.onMoveTask).toHaveBeenCalledWith('task-test-drop', 'col-todo')
  })
})
