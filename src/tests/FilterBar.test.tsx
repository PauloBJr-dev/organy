import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../components/FilterBar'
import type { FilterScope, FilterState } from '../types/kanban'

describe('FilterBar Component — Minimalist Stitch Filter Bar', () => {
  const baseFilters: FilterState = {
    searchQuery: '',
    priority: 'all',
    tag: null,
    scope: 'all',
    weekScope: 'this_week',
  }

  describe('1. Renderização e Estrutura Semântica', () => {
    it('renderiza o prefixo Filtros: com ícone e as 5 pílulas de escopo', () => {
      const onFilterChange = vi.fn()
      render(<FilterBar filters={baseFilters} onFilterChange={onFilterChange} />)

      expect(screen.getByText('Filtros:')).toBeInTheDocument()

      const expectedScopes = [
        { label: 'Todas', ariaName: 'Filtrar tarefas: Todas' },
        { label: 'Hoje', ariaName: 'Filtrar tarefas: Hoje' },
        { label: 'Atrasadas', ariaName: 'Filtrar tarefas: Atrasadas' },
        { label: 'Próximas', ariaName: 'Filtrar tarefas: Próximas' },
        { label: 'Concluídas', ariaName: 'Filtrar tarefas: Concluídas' },
      ]

      for (const { label, ariaName } of expectedScopes) {
        expect(screen.getByText(label)).toBeInTheDocument()
        const button = screen.getByRole('button', { name: ariaName })
        expect(button).toBeInTheDocument()
        expect(button).toHaveAttribute('type', 'button')
      }
    })

    it('renderiza o botão de ordenação por prazo com ícone e rótulo acessível', () => {
      render(<FilterBar filters={baseFilters} onFilterChange={vi.fn()} />)

      const sortBtn = screen.getByRole('button', { name: 'Ordenar por Prazo' })
      expect(sortBtn).toBeInTheDocument()
      expect(sortBtn).toHaveAttribute('type', 'button')
      expect(sortBtn).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('2. Estados Visuais Ativos/Inativos e Tokens de Design', () => {
    it('aplica classes ativas na pílula correspondente ao escopo ativo e inativas nas outras', () => {
      const filtersWithToday: FilterState = { ...baseFilters, scope: 'today' }
      render(<FilterBar filters={filtersWithToday} onFilterChange={vi.fn()} />)

      const todayBtn = screen.getByRole('button', { name: 'Filtrar tarefas: Hoje' })
      const allBtn = screen.getByRole('button', { name: 'Filtrar tarefas: Todas' })
      const overdueBtn = screen.getByRole('button', {
        name: 'Filtrar tarefas: Atrasadas',
      })

      // Ativo
      expect(todayBtn).toHaveAttribute('aria-pressed', 'true')
      expect(todayBtn.className).toContain('bg-slate-900')
      expect(todayBtn.className).toContain('text-white')
      expect(todayBtn.className).toContain('dark:bg-white')
      expect(todayBtn.className).toContain('dark:text-slate-900')
      expect(todayBtn.className).toContain('shadow-xs')

      // Inativo
      expect(allBtn).toHaveAttribute('aria-pressed', 'false')
      expect(allBtn.className).toContain('bg-slate-100')
      expect(allBtn.className).toContain('dark:bg-slate-800')
      expect(allBtn.className).toContain('text-slate-600')
      expect(allBtn.className).toContain('dark:text-slate-300')

      expect(overdueBtn).toHaveAttribute('aria-pressed', 'false')
      expect(overdueBtn.className).toContain('bg-slate-100')
    })

    it('destaca visualmente cada um dos escopos quando ativos', () => {
      const scopes: FilterScope[] = ['all', 'today', 'overdue', 'upcoming', 'completed']
      const labelMap: Record<FilterScope, string> = {
        all: 'Todas',
        today: 'Hoje',
        overdue: 'Atrasadas',
        upcoming: 'Próximas',
        completed: 'Concluídas',
      }

      for (const scope of scopes) {
        const { unmount } = render(
          <FilterBar filters={{ ...baseFilters, scope }} onFilterChange={vi.fn()} />
        )

        const activeBtn = screen.getByRole('button', {
          name: `Filtrar tarefas: ${labelMap[scope]}`,
        })
        expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
        expect(activeBtn.className).toContain('bg-slate-900')

        unmount()
      }
    })

    it('aplica classes de estilo ativas e aria-pressed quando isSortedByDueDate é true', () => {
      render(
        <FilterBar
          filters={baseFilters}
          onFilterChange={vi.fn()}
          isSortedByDueDate={true}
        />
      )

      const sortBtn = screen.getByRole('button', { name: 'Ordenar por Prazo' })
      expect(sortBtn).toHaveAttribute('aria-pressed', 'true')
      expect(sortBtn.className).toContain('bg-blue-50')
      expect(sortBtn.className).toContain('text-blue-600')
      expect(sortBtn.className).toContain('border-blue-200/80')
      expect(sortBtn.className).toContain('dark:text-blue-400')
    })

    it('aplica classes de estilo inativas quando isSortedByDueDate é false', () => {
      render(
        <FilterBar
          filters={baseFilters}
          onFilterChange={vi.fn()}
          isSortedByDueDate={false}
        />
      )

      const sortBtn = screen.getByRole('button', { name: 'Ordenar por Prazo' })
      expect(sortBtn).toHaveAttribute('aria-pressed', 'false')
      expect(sortBtn.className).toContain('text-slate-600')
      expect(sortBtn.className).toContain('dark:text-slate-400')
      expect(sortBtn.className).not.toContain('bg-blue-50')
    })

    it('possui anéis de foco acessíveis focus-visible em todos os botões', () => {
      render(<FilterBar filters={baseFilters} onFilterChange={vi.fn()} />)

      const buttons = screen.getAllByRole('button')
      for (const btn of buttons) {
        expect(btn.className).toContain('focus-visible:ring-2')
        expect(btn.className).toContain('focus-visible:ring-blue-500/50')
      }
    })
  })

  describe('3. Disparo de Eventos e Interações', () => {
    it('dispara onFilterChange com o escopo correto ao clicar em cada pílula', () => {
      const onFilterChange = vi.fn()
      render(<FilterBar filters={baseFilters} onFilterChange={onFilterChange} />)

      // Clicar em Hoje
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar tarefas: Hoje' }))
      expect(onFilterChange).toHaveBeenCalledWith({ scope: 'today' })

      // Clicar em Atrasadas
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar tarefas: Atrasadas' }))
      expect(onFilterChange).toHaveBeenCalledWith({ scope: 'overdue' })

      // Clicar em Próximas
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar tarefas: Próximas' }))
      expect(onFilterChange).toHaveBeenCalledWith({ scope: 'upcoming' })

      // Clicar em Concluídas
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar tarefas: Concluídas' }))
      expect(onFilterChange).toHaveBeenCalledWith({ scope: 'completed' })

      // Clicar em Todas
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar tarefas: Todas' }))
      expect(onFilterChange).toHaveBeenCalledWith({ scope: 'all' })

      expect(onFilterChange).toHaveBeenCalledTimes(5)
    })

    it('dispara onToggleSortByDueDate ao clicar no botão de ordenação', () => {
      const onToggleSortByDueDate = vi.fn()
      render(
        <FilterBar
          filters={baseFilters}
          onFilterChange={vi.fn()}
          onToggleSortByDueDate={onToggleSortByDueDate}
        />
      )

      const sortBtn = screen.getByRole('button', { name: 'Ordenar por Prazo' })
      fireEvent.click(sortBtn)

      expect(onToggleSortByDueDate).toHaveBeenCalledTimes(1)
    })

    it('não lança erro ao clicar no botão de ordenação se onToggleSortByDueDate não for fornecido', () => {
      render(<FilterBar filters={baseFilters} onFilterChange={vi.fn()} />)

      const sortBtn = screen.getByRole('button', { name: 'Ordenar por Prazo' })
      expect(() => fireEvent.click(sortBtn)).not.toThrow()
    })
  })

  describe('4. Contrato de Props Opcionais e Robustez', () => {
    it('aceita props opcionais (allTags, totalFiltered, allTasksCount, searchInputRef) sem quebras', () => {
      const searchRef = React.createRef<HTMLInputElement>()
      const onFilterChange = vi.fn()

      const { container } = render(
        <FilterBar
          filters={{
            searchQuery: 'estudo',
            priority: 'high',
            tag: 'urgente',
            scope: 'all',
            weekScope: 'this_week',
          }}
          onFilterChange={onFilterChange}
          allTags={['urgente', 'estudo', 'pessoal']}
          totalFiltered={3}
          allTasksCount={15}
          searchInputRef={searchRef}
          isSortedByDueDate={true}
        />
      )

      expect(container).toBeInTheDocument()
      expect(screen.getByText('Filtros:')).toBeInTheDocument()
    })

    it('garante que elementos legados e pesados não são renderizados (proteção contra regressão)', () => {
      render(<FilterBar filters={baseFilters} onFilterChange={vi.fn()} />)

      // Garante ausência de inputs de texto legados embutidos dentro do FilterBar
      expect(screen.queryByPlaceholderText(/buscar tarefas/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      // Garante ausência de selects dropdown legados
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/filtrar por prioridade/i)).not.toBeInTheDocument()

      // Garante ausência de grupos legados
      expect(screen.queryByLabelText(/filtro semanal do kanban/i)).not.toBeInTheDocument()
    })
  })
})
