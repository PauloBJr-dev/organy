import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Board } from '../components/Board'
import type { Column, Task } from '../types/kanban'

describe('Board', () => {
  const mockColumns: Column[] = [
    { id: 'col-todo', title: 'A Fazer', order: 0, colorTheme: 'blue', isPermanent: true },
    {
      id: 'col-doing',
      title: 'Em Progresso',
      order: 1,
      colorTheme: 'amber',
      isPermanent: true,
    },
    {
      id: 'col-custom',
      title: 'Revisão Custom',
      order: 2,
      colorTheme: 'purple',
      isPermanent: false,
    },
    {
      id: 'col-done',
      title: 'Concluído',
      order: 3,
      colorTheme: 'emerald',
      isPermanent: true,
    },
  ]

  const mockTasks: Task[] = [
    {
      id: 't-1',
      title: 'Tarefa 1',
      columnId: 'col-todo',
      priority: 'medium',
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't-2',
      title: 'Tarefa 2',
      columnId: 'col-doing',
      priority: 'high',
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const defaultProps = {
    columns: mockColumns,
    tasks: mockTasks,
    onNewTaskInColumn: vi.fn(),
    onEditTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onMoveTask: vi.fn(),
    onToggleSubtask: vi.fn(),
    onStartFocus: vi.fn(),
    onAddColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    onMoveColumn: vi.fn(),
    onReorderColumns: vi.fn(),
    onUpdateColumn: vi.fn(),
  }

  it('renderiza todas as colunas e suas tarefas respectivas', () => {
    render(<Board {...defaultProps} />)

    expect(screen.getByText('A Fazer')).toBeInTheDocument()
    expect(screen.getByText('Em Progresso')).toBeInTheDocument()
    expect(screen.getByText('Revisão Custom')).toBeInTheDocument()
    expect(screen.getByText('Concluído')).toBeInTheDocument()
    expect(screen.getByText('Tarefa 1')).toBeInTheDocument()
    expect(screen.getByText('Tarefa 2')).toBeInTheDocument()
  })

  it('oculta botão de exclusão em colunas permanentes e exibe apenas em colunas customizadas', () => {
    render(<Board {...defaultProps} />)

    // Colunas permanentes não devem ter o botão de excluir
    expect(screen.queryByLabelText('Excluir coluna A Fazer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Excluir coluna Em Progresso')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Excluir coluna Concluído')).not.toBeInTheDocument()

    // Coluna não-permanente deve ter o botão de excluir
    const deleteCustomBtn = screen.getByLabelText('Excluir coluna Revisão Custom')
    expect(deleteCustomBtn).toBeInTheDocument()

    fireEvent.click(deleteCustomBtn)
    expect(defaultProps.onDeleteColumn).toHaveBeenCalledWith('col-custom')
  })

  it('permite mover colunas para a esquerda e direita com os botões direcionais', () => {
    const onMoveColumn = vi.fn()
    render(<Board {...defaultProps} onMoveColumn={onMoveColumn} />)

    // Primeira coluna ('A Fazer') não tem botão para a esquerda, mas tem para a direita
    expect(
      screen.queryByLabelText('Mover coluna A Fazer para a esquerda')
    ).not.toBeInTheDocument()
    const moveRightFirst = screen.getByLabelText('Mover coluna A Fazer para a direita')
    fireEvent.click(moveRightFirst)
    expect(onMoveColumn).toHaveBeenCalledWith('col-todo', 'right')

    // Coluna do meio ('Em Progresso') tem ambos os botões
    const moveLeftDoing = screen.getByLabelText(
      'Mover coluna Em Progresso para a esquerda'
    )
    fireEvent.click(moveLeftDoing)
    expect(onMoveColumn).toHaveBeenCalledWith('col-doing', 'left')
  })

  it('permite edição inline de título e tema de cor para colunas customizadas e oculta para colunas padrão', () => {
    const onUpdateColumn = vi.fn()
    render(<Board {...defaultProps} onUpdateColumn={onUpdateColumn} />)

    // Colunas padrão não exibem botão de edição
    expect(screen.queryByLabelText('Editar coluna A Fazer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Editar coluna Em Progresso')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Editar coluna Concluído')).not.toBeInTheDocument()

    // Clicar no botão de edição da coluna customizada 'Revisão Custom'
    const editBtn = screen.getByLabelText('Editar coluna Revisão Custom')
    fireEvent.click(editBtn)

    // Campo de input aparece
    const titleInput = screen.getByLabelText('Nome da coluna')
    fireEvent.change(titleInput, { target: { value: 'Revisão Final' } })

    // Selecionar novo tema (ex: Âmbar)
    const amberTheme = screen.getByLabelText('Âmbar')
    fireEvent.click(amberTheme)

    // Salvar
    const saveBtn = screen.getByLabelText('Salvar alterações da coluna')
    fireEvent.click(saveBtn)

    expect(onUpdateColumn).toHaveBeenCalledWith('col-custom', {
      title: 'Revisão Final',
      colorTheme: 'amber',
    })
  })

  it('suporta arrastar e soltar (drag & drop) para reordenar colunas com indicador visual', () => {
    const onReorderColumns = vi.fn()
    render(<Board {...defaultProps} onReorderColumns={onReorderColumns} />)

    const secondColumnEl = document.getElementById('column-col-doing')!

    // Simula arrastar coluna sobre a segunda coluna
    fireEvent.dragOver(secondColumnEl, {
      dataTransfer: {
        types: ['text/kanban-column-id'],
        setData: vi.fn(),
        getData: vi.fn(),
      },
      clientX: 50,
    })

    // Deve exibir o indicador de drop
    expect(screen.getByTestId(/column-drop-(left|right)/)).toBeInTheDocument()

    // Simula soltar a primeira coluna sobre a segunda coluna
    fireEvent.drop(secondColumnEl, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/kanban-column-id' ? 'col-todo' : ''),
      },
    })

    expect(onReorderColumns).toHaveBeenCalled()
  })

  it('permite adicionar uma nova coluna com nome e tema de cor', () => {
    const onAddColumn = vi.fn()
    render(<Board {...defaultProps} onAddColumn={onAddColumn} />)

    // Open add column form
    const addColBtn = screen.getByText('Adicionar Coluna')
    fireEvent.click(addColBtn)

    expect(screen.getByText('Nova Coluna')).toBeInTheDocument()

    // Type column name
    const input = screen.getByPlaceholderText('Nome da coluna...')
    fireEvent.change(input, { target: { value: 'Bloqueado' } })

    // Select color theme (e.g. Rosa)
    const roseThemeBtn = screen.getByTitle('Rosa')
    fireEvent.click(roseThemeBtn)

    // Submit
    const submitBtn = screen.getByText('Criar Coluna')
    fireEvent.click(submitBtn)

    expect(onAddColumn).toHaveBeenCalledWith('Bloqueado', 'rose')
  })

  it('gerencia o estado de drop centralizado entre colunas evitando colunas presas', () => {
    const onMoveTask = vi.fn()
    render(<Board {...defaultProps} onMoveTask={onMoveTask} />)

    const todoCol = document.getElementById('column-col-todo')!
    const doingCol = document.getElementById('column-col-doing')!

    // 1. Inicialmente, nenhum indicador de drop está visível
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument()

    // 2. Arrastar sobre a coluna "A Fazer"
    fireEvent.dragOver(todoCol, {
      dataTransfer: {
        types: ['text/plain'],
        dropEffect: 'move',
      },
    })

    // Apenas a coluna "A Fazer" deve ter o indicador ativo
    expect(screen.getByText('Solte para mover para A Fazer')).toBeInTheDocument()
    expect(
      screen.queryByText('Solte para mover para Em Progresso')
    ).not.toBeInTheDocument()

    // 3. Mover o cursor para a coluna "Em Progresso"
    fireEvent.dragOver(doingCol, {
      dataTransfer: {
        types: ['text/plain'],
        dropEffect: 'move',
      },
    })

    // "A Fazer" deve perder o indicador e "Em Progresso" deve ser a única ativa
    expect(screen.queryByText('Solte para mover para A Fazer')).not.toBeInTheDocument()
    expect(screen.getByText('Solte para mover para Em Progresso')).toBeInTheDocument()

    // 4. Disparar evento global 'dragend'
    fireEvent(window, new Event('dragend'))

    // Nenhuma coluna deve permanecer ativa
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument()
  })

  it('limpa o indicador de drop e aciona onMoveTask ao soltar uma tarefa', () => {
    const onMoveTask = vi.fn()
    render(<Board {...defaultProps} onMoveTask={onMoveTask} />)

    const todoCol = document.getElementById('column-col-todo')!

    // Arrastar sobre a coluna
    fireEvent.dragOver(todoCol, {
      dataTransfer: {
        types: ['text/plain'],
        dropEffect: 'move',
      },
    })
    expect(screen.getByTestId('drop-indicator')).toBeInTheDocument()

    // Soltar tarefa
    fireEvent.drop(todoCol, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 't-2' : ''),
      },
    })

    // Deve limpar o indicador e mover a tarefa
    expect(screen.queryByTestId('drop-indicator')).not.toBeInTheDocument()
    expect(onMoveTask).toHaveBeenCalledWith('t-2', 'col-todo')
  })
})
