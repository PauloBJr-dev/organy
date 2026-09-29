import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Header } from './components/Header'
import { Sidebar, type AppView } from './components/Sidebar'
import { MetricsView } from './components/metrics'
import { SettingsView } from './components/settings'
import { ProfileView } from './components/profile'
import { PomodoroFullscreen } from './components/PomodoroFullscreen'
import { DailyFocusBanner } from './components/DailyFocusBanner'
import { FilterBar } from './components/FilterBar'
import { Board } from './components/Board'
import { TaskModal } from './components/TaskModal'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ColumnDeleteModal } from './components/ColumnDeleteModal'
import { ShortcutsModal } from './components/ShortcutsModal'
import { ToastContainer } from './components/ToastContainer'
import { ResetPasswordView } from './views/ResetPasswordView'
import { AuthView } from './views/AuthView'
import { AcademicView, type AcademicViewHandle } from './components/academic'
import { useKanban } from './hooks/useKanban'
import { usePomodoro } from './hooks/usePomodoro'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { ToastProvider, useToast } from './hooks/useToast'
import { userPreferencesService } from './services/userPreferencesService'
import {
  pomodoroSessionService,
  type ActivePomodoroSession,
} from './services/pomodoroSessionService'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import {
  DEFAULT_COLUMN_IDS,
  type Task,
  type Column,
  type DeleteColumnAction,
} from './types/kanban'

export const AppContent: React.FC = () => {
  const toast = useToast()
  const {
    user,
    loading: authLoading,
    isGuestAcknowledged,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalInitialTab,
    isPasswordRecovery,
  } = useAuth()

  // Gerenciamento de Rota SPA para redefinição de senha
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') return window.location.pathname
    return '/'
  })

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const {
    columns,
    tasks,
    allTasksCount,
    filters,
    setFilters,
    allTags,
    stats,
    hiddenColumnIds,
    hideColumn,
    showColumn,
    addTask,
    updateTask,
    deleteTask,
    restoreTask,
    moveTask,
    toggleSubtask,
    addColumn,
    updateColumn,
    deleteColumnWithOptions,
    reorderColumns,
    moveColumn,
    exportData,
    importData,
    resetToSeed,
  } = useKanban()

  // Theme Management (Dark / Light)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyflow_theme')
      if (saved) return saved === 'dark'
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      }
    }
    return false
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('dailyflow_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('dailyflow_theme', 'light')
    }
  }, [isDark])

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      if (user) {
        userPreferencesService
          .syncUserPreferences(user.id, { theme: next ? 'dark' : 'light' })
          .catch((err) => console.error('Erro ao sincronizar tema:', err))
      }
      return next
    })
  }, [user])

  // Abertura automática do AuthModal na primeira visita
  useEffect(() => {
    if (
      !authLoading &&
      !user &&
      !isGuestAcknowledged &&
      currentPath !== '/reset-password' &&
      !isPasswordRecovery
    ) {
      openAuthModal()
    }
  }, [
    authLoading,
    user,
    isGuestAcknowledged,
    openAuthModal,
    currentPath,
    isPasswordRecovery,
  ])

  // Pomodoro Integration
  const handleTaskMinuteLogged = useCallback(
    (taskId: string, minutes: number) => {
      const task = tasks.find((t) => t.id === taskId)
      const currentMins = task?.pomodoroMinutesSpent || 0
      updateTask(taskId, { pomodoroMinutesSpent: currentMins + minutes })
    },
    [tasks, updateTask]
  )

  const handleActiveSessionChange = useCallback(
    (activeSession: ActivePomodoroSession | null) => {
      if (!user) return
      pomodoroSessionService
        .saveActiveSession(user.id, activeSession)
        .catch((err) =>
          console.error('Erro ao sincronizar timer ativo no Supabase:', err)
        )
    },
    [user]
  )

  const handleSessionCompleted = useCallback(
    (record: {
      taskId?: string | null
      mode: 'work' | 'break' | 'short_break' | 'long_break'
      durationMinutes: number
      completedAt: string
    }) => {
      if (!user) return
      const normalizedMode = record.mode === 'work' ? 'work' : 'break'
      pomodoroSessionService
        .logCompletedSession(user.id, {
          taskId: record.taskId,
          mode: normalizedMode,
          durationMinutes: record.durationMinutes,
          completedAt: record.completedAt,
        })
        .catch((err) =>
          console.error('Erro ao registrar sessão pomodoro concluída no Supabase:', err)
        )
    },
    [user]
  )

  const {
    session,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetTimer,
    switchMode,
    clearFocusedTask,
    completeFocusSession,
    formatTime,
    updateDurations,
    toggleSound,
    updateSettings,
    restoreActiveSession,
  } = usePomodoro({
    onTaskMinuteLogged: handleTaskMinuteLogged,
    onActiveSessionChange: handleActiveSessionChange,
    onSessionCompleted: handleSessionCompleted,
  })

  const [isPomodoroFullscreen, setIsPomodoroFullscreen] = useState(false)

  const handlePomodoroPlayPause = useCallback(() => {
    if (session.isRunning) {
      pauseFocus()
    } else {
      resumeFocus()
      setIsPomodoroFullscreen(true)
    }
  }, [session.isRunning, pauseFocus, resumeFocus])

  const handleStartFocus = useCallback(
    (taskId: string, taskTitle: string) => {
      startFocus(taskId, taskTitle)
      setIsPomodoroFullscreen(true)
    },
    [startFocus]
  )

  // Active view navigation ('kanban' | 'academic' | 'metrics' | 'settings' | 'profile')
  const [activeView, setActiveView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyflow_active_view')
      if (
        saved === 'kanban' ||
        saved === 'academic' ||
        saved === 'metrics' ||
        saved === 'settings' ||
        saved === 'profile'
      ) {
        return saved
      }
    }
    return 'kanban'
  })

  // Sidebar Collapse & Mobile Drawer State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('organy_sidebar_collapsed') ??
        localStorage.getItem('dailyflow_sidebar_collapsed') ??
        localStorage.getItem('organocat_sidebar_collapsed')
      return saved === 'true'
    }
    return false
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('organy_sidebar_collapsed', String(isSidebarCollapsed))
    }
  }, [isSidebarCollapsed])

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      if (user) {
        userPreferencesService
          .syncUserPreferences(user.id, { sidebarCollapsed: next })
          .catch((err) => console.error('Erro ao sincronizar sidebarCollapsed:', err))
      }
      return next
    })
  }, [user])

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false)
  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev)
    } else {
      setIsSidebarCollapsed((prev) => !prev)
    }
  }, [])

  // Zen Mode
  const [isZenMode, setIsZenMode] = useState(false)

  const handleViewChange = useCallback(
    (view: AppView) => {
      setActiveView(view)
      setIsZenMode(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('dailyflow_active_view', view)
      }
      if (user) {
        userPreferencesService
          .syncUserPreferences(user.id, { activeView: view })
          .catch((err) => console.error('Erro ao sincronizar activeView:', err))
      }
    },
    [user]
  )

  const [academicLayoutMode, setAcademicLayoutMode] = useState<'grid' | 'studio'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyflow_academic_layout_mode')
      if (saved === 'grid' || saved === 'studio') return saved
    }
    return 'grid'
  })

  const [academicViewMode, setAcademicViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyflow_academic_view_mode')
      if (saved === 'grid' || saved === 'list') return saved
    }
    return 'grid'
  })

  const handleAcademicLayoutModeChange = useCallback(
    (mode: 'grid' | 'studio') => {
      setAcademicLayoutMode(mode)
      if (user) {
        userPreferencesService
          .syncUserPreferences(user.id, { academicLayoutMode: mode })
          .catch((err) => console.error('Erro ao sincronizar academicLayoutMode:', err))
      }
    },
    [user]
  )

  const handleAcademicViewModeChange = useCallback(
    (mode: 'grid' | 'list') => {
      setAcademicViewMode(mode)
      if (user) {
        userPreferencesService
          .syncUserPreferences(user.id, { academicViewMode: mode })
          .catch((err) => console.error('Erro ao sincronizar academicViewMode:', err))
      }
    },
    [user]
  )

  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Sincronização e Restauração de Preferências e Sessão Pomodoro Ativa Cross-Device
  useEffect(() => {
    if (!user) return

    let isMounted = true

    // 1. Carregar preferências do Supabase
    userPreferencesService
      .fetchUserPreferences(user.id)
      .then((prefs) => {
        if (!isMounted || !prefs) return

        if (prefs.theme) {
          setIsDark(prefs.theme === 'dark')
        }
        if (prefs.sidebarCollapsed !== undefined) {
          setIsSidebarCollapsed(prefs.sidebarCollapsed)
        }
        if (prefs.activeView) {
          setActiveView(prefs.activeView)
        }
        if (prefs.academicLayoutMode) {
          setAcademicLayoutMode(prefs.academicLayoutMode)
        }
        if (prefs.academicViewMode) {
          setAcademicViewMode(prefs.academicViewMode)
        }
        if (prefs.pomodoro) {
          const current = sessionRef.current
          updateSettings({
            workMinutes:
              prefs.pomodoro.workDurationMinutes ?? Math.round(current.workDuration / 60),
            breakMinutes:
              prefs.pomodoro.breakDurationMinutes ??
              Math.round(current.breakDuration / 60),
            longBreakMinutes:
              prefs.pomodoro.longBreakDurationMinutes ??
              Math.round(current.longBreakDuration / 60),
            longBreakCycles: prefs.pomodoro.longBreakCycles ?? current.totalCycles ?? 4,
            autoStartBreaks:
              prefs.pomodoro.autoStartBreaks ?? current.autoStartBreaks ?? true,
            autoStartFocus:
              prefs.pomodoro.autoStartFocus ?? current.autoStartFocus ?? false,
            strictFocusMode:
              prefs.pomodoro.strictFocusMode ?? current.strictFocusMode ?? false,
            isSoundEnabled:
              prefs.pomodoro.isSoundEnabled ?? current.isSoundEnabled ?? true,
          })
        }
      })
      .catch((err) => {
        console.error('Falha ao carregar preferências do usuário no Supabase:', err)
      })

    // 2. Restaurar Sessão Ativa de Pomodoro Cross-Device
    pomodoroSessionService
      .fetchActiveSession(user.id)
      .then((activeSession) => {
        if (!isMounted || !activeSession) return
        restoreActiveSession(activeSession)
      })
      .catch((err) => {
        console.error('Falha ao restaurar sessão ativa de Pomodoro:', err)
      })

    return () => {
      isMounted = false
    }
  }, [user, restoreActiveSession, updateSettings])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPomodoroFullscreen) {
          setIsPomodoroFullscreen(false)
        } else if (isZenMode) {
          setIsZenMode(false)
        } else if (isMobileSidebarOpen) {
          setIsMobileSidebarOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPomodoroFullscreen, isZenMode, isMobileSidebarOpen])

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | undefined>(undefined)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const academicViewRef = useRef<AcademicViewHandle>(null)

  const [deleteColumnModalState, setDeleteColumnModalState] = useState<{
    isOpen: boolean
    column: Column | null
    taskCount: number
  }>({
    isOpen: false,
    column: null,
    taskCount: 0,
  })

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    isDanger?: boolean
    requireConfirmationWord?: string
    isDoubleConfirm?: boolean
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Task creation and editing handlers
  const handleOpenNewTask = useCallback(
    (columnId?: string) => {
      setSelectedTask(null)
      setNewTaskColumnId(columnId || columns[0]?.id)
      setIsTaskModalOpen(true)
    },
    [columns]
  )

  const handleOpenNewNote = useCallback(() => {
    if (activeView !== 'academic') {
      handleViewChange('academic')
      setTimeout(() => {
        academicViewRef.current?.openNewNote()
      }, 50)
    } else {
      academicViewRef.current?.openNewNote()
    }
  }, [activeView, handleViewChange])

  const handleFocusSearch = useCallback(() => {
    if (activeView === 'kanban') {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    } else if (activeView === 'academic') {
      academicViewRef.current?.focusSearch()
    }
  }, [activeView])

  const handleOpenShortcuts = useCallback(() => {
    setIsShortcutsModalOpen((prev) => !prev)
  }, [])

  // Register Global Keyboard Navigation Shortcuts
  useGlobalShortcuts({
    onNewTask: () => {
      if (activeView === 'academic') {
        handleOpenNewNote()
      } else {
        handleOpenNewTask()
      }
    },
    onFocusSearch: handleFocusSearch,
    onTogglePomodoro: handlePomodoroPlayPause,
    onOpenShortcuts: handleOpenShortcuts,
    enabled: !isTaskModalOpen && !confirmState.isOpen && !isAuthModalOpen,
  })

  const handleOpenEditTask = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsTaskModalOpen(true)
  }, [])

  const handleSaveTask = useCallback(
    (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, taskId?: string) => {
      if (taskId) {
        updateTask(taskId, taskData)
        toast.info('Tarefa atualizada')
      } else {
        addTask(taskData)
        toast.success('Tarefa criada com sucesso')
      }
    },
    [addTask, updateTask, toast]
  )

  // Confirmation handlers
  const requestDeleteTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId)
      setConfirmState({
        isOpen: true,
        title: 'Excluir Tarefa',
        message: `Tem certeza que deseja excluir a tarefa "${task?.title || 'selecionada'}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir Tarefa',
        isDanger: true,
        onConfirm: () => {
          if (session.taskId === taskId) {
            clearFocusedTask()
          }
          deleteTask(taskId)
          toast.info('Tarefa excluída', {
            action: {
              label: 'Desfazer',
              onClick: () => {
                if (task) restoreTask(task)
              },
            },
          })
        },
      })
    },
    [tasks, session.taskId, clearFocusedTask, deleteTask, restoreTask, toast]
  )

  const handleMoveTask = useCallback(
    (taskId: string, targetColumnId: string, targetIndex?: number) => {
      const task = tasks.find((t) => t.id === taskId)
      const targetCol = columns.find((c) => c.id === targetColumnId)
      moveTask(taskId, targetColumnId, targetIndex)
      if (task && task.columnId !== targetColumnId) {
        toast.info(`Tarefa movida para ${targetCol?.title || 'nova coluna'}`)
      }

      // Encerramento de foco ao mover para "Concluído"
      const isDoneColumn =
        targetColumnId === 'col-done' || targetColumnId.includes('done')
      if (session.taskId === taskId && isDoneColumn) {
        completeFocusSession(taskId)
        toast.success('Parabéns! Sessão de foco concluída junto com a tarefa 🎉')
      }
    },
    [tasks, columns, moveTask, toast, session.taskId, completeFocusSession]
  )

  const handleAddColumn = useCallback(
    (title: string, colorTheme: Column['colorTheme']) => {
      addColumn(title, colorTheme)
      toast.success('Coluna criada com sucesso')
    },
    [addColumn, toast]
  )

  const handleUpdateColumn = useCallback(
    (
      columnId: string,
      updates: { title?: string; colorTheme?: Column['colorTheme'] }
    ) => {
      const col = columns.find((c) => c.id === columnId)
      if (col?.isPermanent || DEFAULT_COLUMN_IDS.includes(columnId as any)) {
        toast.error('Colunas padrão não podem ser editadas')
        return
      }
      updateColumn(columnId, updates)
      toast.success('Coluna atualizada com sucesso')
    },
    [columns, updateColumn, toast]
  )

  const requestDeleteColumn = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId)
      if (!col) return
      if (col.isPermanent || DEFAULT_COLUMN_IDS.includes(columnId as any)) {
        toast.error('Colunas padrão não podem ser excluídas')
        return
      }
      const tasksInCol = tasks.filter((t) => t.columnId === columnId).length
      setDeleteColumnModalState({
        isOpen: true,
        column: col,
        taskCount: tasksInCol,
      })
    },
    [columns, tasks, toast]
  )

  const handleConfirmDeleteColumn = useCallback(
    (columnId: string, action: DeleteColumnAction) => {
      deleteColumnWithOptions(columnId, action)
      toast.info(
        action === 'move_to_todo'
          ? 'Coluna excluída e tarefas movidas para "A Fazer"'
          : 'Coluna e tarefas excluídas'
      )
    },
    [deleteColumnWithOptions, toast]
  )

  const handleFilterChange = useCallback(
    (updates: Partial<typeof filters>) => {
      setFilters((prev) => ({ ...prev, ...updates }))
    },
    [setFilters]
  )

  const handleExport = useCallback(() => {
    exportData()
    toast.success('Backup JSON exportado com sucesso')
  }, [exportData, toast])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          const success = importData(content)
          if (success) {
            toast.success('Dados importados com sucesso!')
          } else {
            toast.error('Formato de arquivo inválido')
          }
        } catch {
          toast.error('Erro ao ler arquivo')
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [importData, toast]
  )

  const handleResetData = useCallback(() => {
    setConfirmState({
      isOpen: true,
      title: 'Restaurar Dados Padrão',
      message:
        'Deseja restaurar o Organy para os dados de demonstração iniciais? Suas alterações locais serão substituídas.',
      confirmText: 'Restaurar',
      isDanger: true,
      requireConfirmationWord: 'RESTAURAR',
      onConfirm: () => {
        resetToSeed()
        toast.info('Dados de demonstração restaurados')
      },
    })
  }, [resetToSeed, toast])

  const totalFocusMinutes = useMemo(() => {
    return tasks.reduce((sum, t) => {
      let mins = t.pomodoroMinutesSpent || 0
      if (t.timeTracked) {
        const trackedSecs =
          (t.timeTracked.inProgressSeconds || 0) + (t.timeTracked.inReviewSeconds || 0)
        mins += Math.floor(trackedSecs / 60)
      }
      return sum + mins
    }, 0)
  }, [tasks])

  if (currentPath === '/reset-password' || isPasswordRecovery) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <ResetPasswordView
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onSuccess={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/')
            }
            setCurrentPath('/')
            openAuthModal('signin')
          }}
          onCancel={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/')
            }
            setCurrentPath('/')
          }}
        />
        <ToastContainer />
      </div>
    )
  }

  // Visualização dedicada de Autenticação na primeira visita (sem blur e sem rolagem no fundo)
  if (!authLoading && !user && !isGuestAcknowledged) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <AuthView
          initialTab={authModalInitialTab || 'signup'}
          showBackToBoard={false}
          onSuccess={() => {
            closeAuthModal()
          }}
        />
        <ToastContainer />
      </div>
    )
  }

  // Visualização dedicada de Autenticação quando visitante clica em "Entrar ou Criar Conta"
  if (isAuthModalOpen && !user) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <AuthView
          initialTab={authModalInitialTab || 'signin'}
          showBackToBoard={true}
          onBackToBoard={closeAuthModal}
          onSuccess={() => {
            closeAuthModal()
          }}
        />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-row transition-colors duration-200 selection:bg-blue-500 selection:text-white">
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar (Hidden in Academic Zen Mode) */}
      {!isZenMode && (
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* Main Content Column */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ${
          isZenMode ? 'md:pl-0' : isSidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-64'
        }`}
      >
        {/* App Header (Hidden in Academic Zen Mode) */}
        {!isZenMode && (
          <Header
            activeView={activeView}
            onViewChange={handleViewChange}
            onToggleSidebar={handleToggleSidebar}
            onNewTask={() => handleOpenNewTask()}
            onNewNote={handleOpenNewNote}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            stats={{
              completedCount: stats.completedCount,
              total: stats.total,
              completionRate: stats.completionRate,
            }}
          />
        )}

        {/* Main Viewport Container */}
        <main
          id="main-content"
          className={
            isZenMode
              ? 'flex-1 w-full p-0 overflow-hidden'
              : 'flex-1 w-full px-6 lg:px-8 py-6 space-y-6'
          }
        >
          {/* TAB 1: KANBAN */}
          {activeView === 'kanban' && (
            <>
              {/* Monolithic Daily Focus Banner & Integrated Pomodoro */}
              <DailyFocusBanner
                stats={{
                  total: stats.total,
                  completedCount: stats.completedCount,
                  completionRate: stats.completionRate,
                }}
                focusMinutesSpent={totalFocusMinutes}
                pomodoroSession={session}
                onPlayPause={handlePomodoroPlayPause}
                onReset={resetTimer}
                onSwitchMode={switchMode}
                onClearTask={clearFocusedTask}
                formatTime={formatTime}
                onUpdateDurations={updateDurations}
                onToggleSound={toggleSound}
                onUpdateSettings={updateSettings}
                onOpenFullscreen={() => setIsPomodoroFullscreen(true)}
              />

              {/* 2- Filtros (FilterBar) */}
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                allTags={allTags}
                totalFiltered={tasks.length}
                allTasksCount={allTasksCount}
                searchInputRef={searchInputRef}
              />

              {/* 3- Kanban (Board) */}
              <section aria-label="Quadro Kanban" className="pt-2">
                <Board
                  columns={columns}
                  tasks={tasks}
                  hiddenColumnIds={hiddenColumnIds}
                  onHideColumn={hideColumn}
                  onShowColumn={showColumn}
                  onNewTaskInColumn={handleOpenNewTask}
                  onEditTask={handleOpenEditTask}
                  onDeleteTask={requestDeleteTask}
                  onMoveTask={handleMoveTask}
                  onToggleSubtask={toggleSubtask}
                  onStartFocus={handleStartFocus}
                  onAddColumn={handleAddColumn}
                  onDeleteColumn={requestDeleteColumn}
                  onMoveColumn={moveColumn}
                  onReorderColumns={reorderColumns}
                  onUpdateColumn={handleUpdateColumn}
                  focusedTaskId={session.taskId}
                />
              </section>
            </>
          )}

          {/* TAB 2: ESPAÇO ACADÊMICO */}
          {activeView === 'academic' && (
            <AcademicView
              ref={academicViewRef}
              isZenMode={isZenMode}
              onZenModeChange={setIsZenMode}
              layoutMode={academicLayoutMode}
              onLayoutModeChange={handleAcademicLayoutModeChange}
              viewMode={academicViewMode}
              onViewModeChange={handleAcademicViewModeChange}
            />
          )}

          {/* TAB 3: MÉTRICAS */}
          {activeView === 'metrics' && (
            <MetricsView tasks={tasks} columns={columns} allTags={allTags} />
          )}

          {/* TAB 4: CONFIGURAÇÕES */}
          {activeView === 'settings' && (
            <SettingsView
              userId={user?.id}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              workMinutes={Math.round(session.workDuration / 60)}
              breakMinutes={Math.round(session.breakDuration / 60)}
              longBreakMinutes={Math.round(session.longBreakDuration / 60)}
              longBreakCycles={session.totalCycles}
              autoStartBreaks={session.autoStartBreaks}
              autoStartFocus={session.autoStartFocus}
              strictFocusMode={session.strictFocusMode}
              isSoundEnabled={session.isSoundEnabled ?? true}
              onUpdateDurations={updateDurations}
              onToggleSound={toggleSound}
              onUpdateSettings={(settings) => {
                const workMins =
                  settings.workDurationMinutes ?? Math.round(session.workDuration / 60)
                const breakMins =
                  settings.breakDurationMinutes ?? Math.round(session.breakDuration / 60)
                const longBreakMins =
                  settings.longBreakDurationMinutes ??
                  Math.round(session.longBreakDuration / 60)
                const cycles = settings.longBreakCycles ?? session.totalCycles ?? 4
                const autoBreaks =
                  settings.autoStartBreaks ?? session.autoStartBreaks ?? true
                const autoFocus =
                  settings.autoStartFocus ?? session.autoStartFocus ?? false
                const strictFocus =
                  settings.strictFocusMode ?? session.strictFocusMode ?? false
                const isSound = settings.isSoundEnabled ?? session.isSoundEnabled ?? true

                updateSettings({
                  workMinutes: workMins,
                  breakMinutes: breakMins,
                  longBreakMinutes: longBreakMins,
                  longBreakCycles: cycles,
                  autoStartBreaks: autoBreaks,
                  autoStartFocus: autoFocus,
                  strictFocusMode: strictFocus,
                  isSoundEnabled: isSound,
                })

                if (user) {
                  userPreferencesService
                    .syncUserPreferences(user.id, {
                      pomodoro: {
                        workDurationMinutes: workMins,
                        breakDurationMinutes: breakMins,
                        longBreakDurationMinutes: longBreakMins,
                        longBreakCycles: cycles,
                        autoStartBreaks: autoBreaks,
                        autoStartFocus: autoFocus,
                        strictFocusMode: strictFocus,
                        isSoundEnabled: isSound,
                      },
                    })
                    .catch((err) =>
                      console.error('Erro ao sincronizar configurações pomodoro:', err)
                    )
                }
              }}
              onExport={handleExport}
              onImport={handleImport}
              onReset={handleResetData}
              onOpenShortcuts={handleOpenShortcuts}
            />
          )}

          {/* TAB 5: PERFIL */}
          {activeView === 'profile' && (
            <ProfileView tasks={tasks} onOpenAuthModal={() => openAuthModal()} />
          )}
        </main>
      </div>

      {/* Fullscreen Pomodoro Timer */}
      {isPomodoroFullscreen && (
        <PomodoroFullscreen
          session={session}
          onPlayPause={handlePomodoroPlayPause}
          onReset={resetTimer}
          onSwitchMode={switchMode}
          onClose={() => setIsPomodoroFullscreen(false)}
          formatTime={formatTime}
        />
      )}

      {/* Task Creation / Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={requestDeleteTask}
        task={selectedTask}
        columns={columns}
        initialColumnId={newTaskColumnId}
        availableTags={allTags}
      />

      {/* Shortcuts Guide Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Minimalist Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger}
        requireConfirmationWord={confirmState.requireConfirmationWord}
        isDoubleConfirm={confirmState.isDoubleConfirm}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Column Deletion Security Modal */}
      <ColumnDeleteModal
        isOpen={deleteColumnModalState.isOpen}
        column={deleteColumnModalState.column}
        taskCount={deleteColumnModalState.taskCount}
        onClose={() => setDeleteColumnModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDeleteColumn}
      />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
