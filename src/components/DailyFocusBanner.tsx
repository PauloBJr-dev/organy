import React, { useMemo } from 'react'
import { Play, Pause, RotateCcw, Maximize2, X } from 'lucide-react'
import type { PomodoroSession, PomodoroMode, CatPurrType } from '../types/kanban'

export interface DailyFocusBannerProps {
  stats: {
    total: number
    completedCount: number
    completionRate: number
  }
  focusMinutesSpent?: number
  pomodoroSession?:
    | {
        mode: PomodoroMode | 'work' | 'break' | 'short_break' | 'long_break'
        timeLeft: number
        isRunning: boolean
        taskTitle?: string | null
        taskId?: string | null
        workDuration?: number
        breakDuration?: number
        longBreakDuration?: number
        isSoundEnabled?: boolean
        catPurrType?: CatPurrType
        catPurrVolume?: number
      }
    | PomodoroSession
  onPlayPause?: () => void
  onReset?: () => void
  onSwitchMode?: (
    mode: PomodoroMode | 'work' | 'break' | 'short_break' | 'long_break'
  ) => void
  onClearTask?: () => void
  formatTime?: (seconds: number) => string
  onOpenFullscreen?: () => void
  onUpdateDurations?: (workMinutes: number, breakMinutes: number) => void
  onToggleSound?: () => void
  onUpdateSettings?: (
    workMinutes: number,
    breakMinutes: number,
    soundEnabled: boolean,
    catPurrType: CatPurrType,
    catPurrVolume: number
  ) => void
}

/**
 * Formata um objeto Date para uma string legível em português: "Quinta-feira, 24 de Outubro"
 */
function formatCurrentDate(date: Date): string {
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' })
  const day = date.getDate()
  const month = date.toLocaleDateString('pt-BR', { month: 'long' })

  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1)

  return `${capitalizedWeekday}, ${day} de ${capitalizedMonth}`
}

export const DailyFocusBanner: React.FC<DailyFocusBannerProps> = ({
  stats,
  pomodoroSession,
  onPlayPause,
  onReset,
  onSwitchMode,
  onClearTask,
  formatTime,
  onOpenFullscreen,
}) => {
  const today = useMemo(() => new Date(), [])
  const dateString = useMemo(() => formatCurrentDate(today), [today])

  const completionRate = Math.min(100, Math.max(0, Math.round(stats.completionRate || 0)))

  // Tag de ritmo dinâmico ou constante
  const productivityBadge =
    completionRate >= 50 || stats.completedCount > 3
      ? 'Produtividade Alta'
      : 'Ritmo Constante'

  // Dados da sessão pomodoro
  const currentMode = pomodoroSession ? pomodoroSession.mode : 'work'
  const isWork = currentMode === 'work'
  const isShortBreak = currentMode === 'short_break' || currentMode === 'break'
  const isLongBreak = currentMode === 'long_break'
  const isRunning = pomodoroSession ? pomodoroSession.isRunning : false
  const timeLeft = pomodoroSession ? pomodoroSession.timeLeft : 25 * 60

  const workDuration =
    pomodoroSession && 'workDuration' in pomodoroSession && pomodoroSession.workDuration
      ? pomodoroSession.workDuration
      : 25 * 60

  const breakDuration =
    pomodoroSession && 'breakDuration' in pomodoroSession && pomodoroSession.breakDuration
      ? pomodoroSession.breakDuration
      : 5 * 60

  const longBreakDuration =
    pomodoroSession &&
    'longBreakDuration' in pomodoroSession &&
    pomodoroSession.longBreakDuration
      ? pomodoroSession.longBreakDuration
      : 15 * 60

  const workMinutes = Math.round(workDuration / 60)
  const breakMinutes = Math.round(breakDuration / 60)
  const longBreakMinutes = Math.round(longBreakDuration / 60)

  const defaultFormat = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`
  }

  const formattedDigitalTime = useMemo(() => {
    if (formatTime) {
      const raw = formatTime(timeLeft)
      if (raw.includes(':')) {
        const parts = raw.split(':')
        return `${parts[0]} : ${parts[1]}`
      }
      return raw
    }
    return defaultFormat(timeLeft)
  }, [formatTime, timeLeft])

  const statusText = useMemo(() => {
    if (!isRunning) return 'Pronto para iniciar ciclo'
    if (isWork) return 'Em foco ativo'
    return 'Em pausa revigorante'
  }, [isRunning, isWork])

  return (
    <section
      aria-label="Resumo do Foco Diário"
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 lg:p-7 relative overflow-hidden transition-all duration-200 ${
        isRunning ? 'border-beam-active ring-1 ring-blue-500/20' : ''
      }`}
    >
      {/* Subtle blur background glow */}
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 w-64 h-64 bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-3xl pointer-events-none"
      />

      {/* Monolithic 50/50 Symmetrical Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        {/* LADO ESQUERDO: Foco Diário & Progresso Linear */}
        <div className="flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                {productivityBadge}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Foco Diário: {dateString}
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
              Você completou{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {stats.completedCount} de {stats.total}
              </span>{' '}
              tarefas planejadas para hoje.{' '}
              {completionRate >= 50
                ? 'Excelente ritmo!'
                : 'Mantenha a consistência nos seus objetivos!'}
            </p>
          </div>

          {/* Barra de Progresso Linear Ultrafina no Rodapé */}
          <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Progresso diário • {stats.completedCount} de {stats.total} tarefas
                concluídas hoje ({completionRate}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Console Integrado do Pomodoro */}
        <div className="flex flex-col justify-between space-y-4 lg:border-l lg:border-slate-200/70 lg:dark:border-slate-800 lg:pl-8">
          {/* Topo: Pílulas de Seleção Rápida de Modo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => onSwitchMode?.('work')}
                aria-label={`Ativar modo de foco de ${workMinutes} minutos`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  isWork
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {workMinutes}m Foco
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode?.('short_break')}
                aria-label={`Ativar modo de pausa de ${breakMinutes} minutos`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  isShortBreak
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {breakMinutes}m Pausa Curta
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode?.('long_break')}
                aria-label={`Ativar modo de pausa longa de ${longBreakMinutes} minutos`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  isLongBreak
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {longBreakMinutes}m Pausa Longa
              </button>
            </div>
          </div>

          {/* Centro: Display Digital Grande & Botões de Ação */}
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <div
                data-testid="pomodoro-digital-display"
                className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {formattedDigitalTime}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span>{statusText}</span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              {/* Reset */}
              <button
                type="button"
                onClick={onReset}
                aria-label="Reiniciar cronômetro"
                title="Reiniciar tempo"
                className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Play/Pause circular em azul cobalto */}
              <button
                type="button"
                onClick={onPlayPause}
                aria-label={isRunning ? 'Pausar cronômetro' : 'Iniciar foco'}
                title={isRunning ? 'Pausar (P)' : 'Iniciar Foco (P)'}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                {isRunning ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              {/* Fullscreen */}
              {onOpenFullscreen && (
                <button
                  type="button"
                  onClick={onOpenFullscreen}
                  aria-label="Expandir para tela cheia"
                  title="Tela Cheia"
                  className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Rodapé: Indicador de Tarefa Vinculada Nivelado */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 min-h-[33px]">
            <div className="flex items-center gap-1.5 truncate max-w-[280px]">
              {pomodoroSession &&
              'taskTitle' in pomodoroSession &&
              pomodoroSession.taskTitle ? (
                <>
                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                    📖 {pomodoroSession.taskTitle}
                  </span>
                  {onClearTask && (
                    <button
                      type="button"
                      onClick={onClearTask}
                      title="Desvincular tarefa"
                      aria-label="Desvincular tarefa do timer"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <span className="italic text-slate-400 dark:text-slate-500">
                  📖 Nenhuma tarefa vinculada (foco livre)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
