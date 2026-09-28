import { useState, useEffect, useCallback, useRef } from 'react'
import confetti from 'canvas-confetti'
import type { PomodoroSession, PomodoroMode, CatPurrType } from '../types/kanban'
import type { ActivePomodoroSession } from '../services/pomodoroSessionService'
import { playWorkCompleteSound, playBreakCompleteSound } from '../services/soundService'
import { notify, requestPermission } from '../services/notificationService'

export const POMODORO_SETTINGS_KEY = 'dailyflow_pomodoro_settings'

const DEFAULT_WORK_TIME = 25 * 60 // 25 minutes
const DEFAULT_BREAK_TIME = 5 * 60 // 5 minutes
const DEFAULT_LONG_BREAK_TIME = 15 * 60 // 15 minutes
const DEFAULT_TOTAL_CYCLES = 4
const DEFAULT_AUTO_START_BREAKS = true
const DEFAULT_AUTO_START_FOCUS = false
const DEFAULT_STRICT_FOCUS_MODE = true
const DEFAULT_DOCUMENT_TITLE = 'Organy - Organização e estudos'

export interface PomodoroSessionCompletedEvent {
  taskId?: string | null
  taskTitle?: string | null
  mode: PomodoroMode
  durationMinutes: number
  completedAt: string
}

export interface UsePomodoroOptions {
  onTaskMinuteLogged?: (taskId: string, minutes: number) => void
  onActiveSessionChange?: (session: ActivePomodoroSession | null) => void
  onSessionCompleted?: (event: PomodoroSessionCompletedEvent) => void
  initialActiveSession?: ActivePomodoroSession | null
}

export interface PomodoroSettingsParams {
  workMinutes?: number
  breakMinutes?: number
  longBreakMinutes?: number
  longBreakCycles?: number
  autoStartBreaks?: boolean
  autoStartFocus?: boolean
  strictFocusMode?: boolean
  isSoundEnabled?: boolean
  catPurrType?: CatPurrType
  catPurrVolume?: number
}

interface PomodoroSettings {
  workDuration: number
  breakDuration: number
  longBreakDuration: number
  totalCycles: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  strictFocusMode: boolean
  isSoundEnabled: boolean
}

const loadSettings = (): PomodoroSettings => {
  const defaults: PomodoroSettings = {
    workDuration: DEFAULT_WORK_TIME,
    breakDuration: DEFAULT_BREAK_TIME,
    longBreakDuration: DEFAULT_LONG_BREAK_TIME,
    totalCycles: DEFAULT_TOTAL_CYCLES,
    autoStartBreaks: DEFAULT_AUTO_START_BREAKS,
    autoStartFocus: DEFAULT_AUTO_START_FOCUS,
    strictFocusMode: DEFAULT_STRICT_FOCUS_MODE,
    isSoundEnabled: true,
  }

  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const saved = localStorage.getItem(POMODORO_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        workDuration:
          typeof parsed.workDuration === 'number' && parsed.workDuration > 0
            ? parsed.workDuration
            : typeof parsed.workDurationMinutes === 'number' &&
                parsed.workDurationMinutes > 0
              ? parsed.workDurationMinutes * 60
              : DEFAULT_WORK_TIME,
        breakDuration:
          typeof parsed.breakDuration === 'number' && parsed.breakDuration > 0
            ? parsed.breakDuration
            : typeof parsed.breakDurationMinutes === 'number' &&
                parsed.breakDurationMinutes > 0
              ? parsed.breakDurationMinutes * 60
              : DEFAULT_BREAK_TIME,
        longBreakDuration:
          typeof parsed.longBreakDuration === 'number' && parsed.longBreakDuration > 0
            ? parsed.longBreakDuration
            : typeof parsed.longBreakDurationMinutes === 'number' &&
                parsed.longBreakDurationMinutes > 0
              ? parsed.longBreakDurationMinutes * 60
              : DEFAULT_LONG_BREAK_TIME,
        totalCycles:
          typeof parsed.totalCycles === 'number' && parsed.totalCycles > 0
            ? parsed.totalCycles
            : typeof parsed.longBreakCycles === 'number' && parsed.longBreakCycles > 0
              ? parsed.longBreakCycles
              : DEFAULT_TOTAL_CYCLES,
        autoStartBreaks:
          typeof parsed.autoStartBreaks === 'boolean'
            ? parsed.autoStartBreaks
            : DEFAULT_AUTO_START_BREAKS,
        autoStartFocus:
          typeof parsed.autoStartFocus === 'boolean'
            ? parsed.autoStartFocus
            : DEFAULT_AUTO_START_FOCUS,
        strictFocusMode:
          typeof parsed.strictFocusMode === 'boolean'
            ? parsed.strictFocusMode
            : DEFAULT_STRICT_FOCUS_MODE,
        isSoundEnabled:
          typeof parsed.isSoundEnabled === 'boolean' ? parsed.isSoundEnabled : true,
      }
    }
  } catch {
    // Ignora erros de parse do localStorage
  }

  return defaults
}

export function usePomodoro(
  optionsOrTaskLogged?: ((taskId: string, minutes: number) => void) | UsePomodoroOptions
) {
  const options: UsePomodoroOptions =
    typeof optionsOrTaskLogged === 'function'
      ? { onTaskMinuteLogged: optionsOrTaskLogged }
      : optionsOrTaskLogged || {}

  const [initialSettings] = useState<PomodoroSettings>(loadSettings)

  const originalTitleRef = useRef<string>(
    typeof document !== 'undefined' && document.title
      ? document.title
      : DEFAULT_DOCUMENT_TITLE
  )
  const completedTitleRef = useRef<string | null>(null)
  const targetEndTimeRef = useRef<number | null>(null)
  const autoTransitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const callbacksRef = useRef(options)
  useEffect(() => {
    callbacksRef.current = options
  })

  const [isUserPaused, setIsUserPaused] = useState<boolean>(false)

  const [session, setSession] = useState<PomodoroSession>(() => ({
    taskId: null,
    taskTitle: undefined,
    timeLeft: initialSettings.workDuration,
    isRunning: false,
    mode: 'work',
    workDuration: initialSettings.workDuration,
    breakDuration: initialSettings.breakDuration,
    longBreakDuration: initialSettings.longBreakDuration,
    currentCycle: 1,
    totalCycles: initialSettings.totalCycles,
    autoStartBreaks: initialSettings.autoStartBreaks,
    autoStartFocus: initialSettings.autoStartFocus,
    strictFocusMode: initialSettings.strictFocusMode,
    isAutoTransitioning: false,
    autoTransitionSecondsLeft: undefined,
    isSoundEnabled: initialSettings.isSoundEnabled,
  }))

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const cancelAutoTransition = useCallback(() => {
    if (autoTransitionTimerRef.current) {
      clearInterval(autoTransitionTimerRef.current)
      autoTransitionTimerRef.current = null
    }
    setSession((prev) => {
      if (!prev.isAutoTransitioning && prev.autoTransitionSecondsLeft === undefined) {
        return prev
      }
      return {
        ...prev,
        isAutoTransitioning: false,
        autoTransitionSecondsLeft: undefined,
      }
    })
  }, [])

  // Sincronização em tempo real do título da aba do navegador
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (session.isAutoTransitioning && session.autoTransitionSecondsLeft !== undefined) {
      const isNextBreak =
        session.mode === 'short_break' ||
        session.mode === 'long_break' ||
        session.mode === 'break'
      const label = isNextBreak ? 'Iniciando Pausa...' : 'Iniciando Foco...'
      document.title = `⏳ (${session.autoTransitionSecondsLeft}s) ${label} | Organy`
      return
    }

    if (session.isRunning) {
      completedTitleRef.current = null
      if (session.timeLeft <= 5 && session.timeLeft > 0) {
        document.title = `⚡ (${formatTime(session.timeLeft)}) Reta Final! Quase lá! | Organy`
      } else if (session.mode === 'work') {
        if (session.taskTitle) {
          document.title = `(${formatTime(session.timeLeft)}) 📖 ${session.taskTitle} | Organy`
        } else {
          document.title = `(${formatTime(session.timeLeft)}) 🎯 Foco & Estudos | Organy`
        }
      } else if (session.mode === 'long_break') {
        document.title = `(${formatTime(session.timeLeft)}) 🌟 Pausa Longa Merecida | Organy`
      } else {
        document.title = `(${formatTime(session.timeLeft)}) ☕ Pausa Revigorante | Organy`
      }
    } else if (isUserPaused) {
      completedTitleRef.current = null
      document.title = `⏸️ (${formatTime(session.timeLeft)}) Pausado | Organy`
    } else if (completedTitleRef.current) {
      document.title = completedTitleRef.current
    } else {
      document.title = originalTitleRef.current
    }
  }, [
    session.isRunning,
    session.isAutoTransitioning,
    session.autoTransitionSecondsLeft,
    session.timeLeft,
    session.mode,
    session.taskTitle,
    isUserPaused,
    formatTime,
  ])

  // Restaura título e interrompe temporizadores ao desmontar o componente
  useEffect(() => {
    return () => {
      if (autoTransitionTimerRef.current) {
        clearInterval(autoTransitionTimerRef.current)
        autoTransitionTimerRef.current = null
      }
      if (typeof document !== 'undefined') {
        document.title = originalTitleRef.current
      }
    }
  }, [])

  // Inicia a contagem regressiva de 5 segundos para transição automática
  const triggerAutoTransition = useCallback((nextMode: PomodoroMode) => {
    if (autoTransitionTimerRef.current) {
      clearInterval(autoTransitionTimerRef.current)
      autoTransitionTimerRef.current = null
    }

    const isNextBreak =
      nextMode === 'short_break' || nextMode === 'long_break' || nextMode === 'break'
    const label = isNextBreak ? 'Iniciando Pausa...' : 'Iniciando Foco...'

    if (typeof document !== 'undefined') {
      document.title = `⏳ (5s) ${label} | Organy`
    }

    setSession((prev) => ({
      ...prev,
      isAutoTransitioning: true,
      autoTransitionSecondsLeft: 5,
    }))

    let seconds = 5
    autoTransitionTimerRef.current = setInterval(() => {
      seconds -= 1
      if (seconds > 0) {
        setSession((prev) => ({
          ...prev,
          isAutoTransitioning: true,
          autoTransitionSecondsLeft: seconds,
        }))
        if (typeof document !== 'undefined') {
          document.title = `⏳ (${seconds}s) ${label} | Organy`
        }
      } else {
        if (autoTransitionTimerRef.current) {
          clearInterval(autoTransitionTimerRef.current)
          autoTransitionTimerRef.current = null
        }
        completedTitleRef.current = null
        setSession((prev) => {
          targetEndTimeRef.current = Date.now() + prev.timeLeft * 1000
          const activeState: ActivePomodoroSession = {
            taskId: prev.taskId,
            taskTitle: prev.taskTitle,
            mode: prev.mode,
            startedAt: new Date().toISOString(),
            durationSeconds: prev.timeLeft,
            isRunning: true,
            pausedTimeLeft: null,
          }
          callbacksRef.current.onActiveSessionChange?.(activeState)
          return {
            ...prev,
            isAutoTransitioning: false,
            autoTransitionSecondsLeft: undefined,
            isRunning: true,
          }
        })
      }
    }, 1000)
  }, [])

  // Função central para processar conclusão de ciclo
  const handleCycleComplete = useCallback(() => {
    targetEndTimeRef.current = null

    setSession((prev) => {
      const isWorkEnding = prev.mode === 'work'

      if (isWorkEnding) {
        if (prev.isSoundEnabled ?? true) {
          playWorkCompleteSound()
        }

        const isLongBreak = prev.currentCycle >= prev.totalCycles
        const nextMode: PomodoroMode = isLongBreak ? 'long_break' : 'short_break'
        const nextTime = isLongBreak ? prev.longBreakDuration : prev.breakDuration

        if (isLongBreak) {
          notify('Pausa Longa Merecida! 🌟', {
            body: 'Você completou seu ciclo de foco. Descanse um pouco mais!',
            icon: '/vite.svg',
          })
          completedTitleRef.current = '🌟 Pausa Longa Merecida! | Organy'
        } else {
          notify('Pausa Curta! ☕', {
            body: 'Excelente trabalho! Hora de fazer uma pausa de descanso.',
            icon: '/vite.svg',
          })
          completedTitleRef.current = '🎉 Foco Concluído! Parabéns! | Organy'
        }

        try {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7 },
          })
        } catch {
          // Silencia falhas caso canvas não esteja disponível
        }

        setIsUserPaused(false)

        if (prev.taskId && callbacksRef.current.onTaskMinuteLogged) {
          callbacksRef.current.onTaskMinuteLogged(
            prev.taskId,
            Math.round(prev.workDuration / 60)
          )
        }

        callbacksRef.current.onSessionCompleted?.({
          taskId: prev.taskId,
          taskTitle: prev.taskTitle,
          mode: 'work',
          durationMinutes: Math.round(prev.workDuration / 60),
          completedAt: new Date().toISOString(),
        })

        callbacksRef.current.onActiveSessionChange?.(null)

        if (prev.autoStartBreaks) {
          setTimeout(() => {
            triggerAutoTransition(nextMode)
          }, 0)
        }

        return {
          ...prev,
          mode: nextMode,
          timeLeft: nextTime,
          isRunning: false,
          isAutoTransitioning: prev.autoStartBreaks,
          autoTransitionSecondsLeft: prev.autoStartBreaks ? 5 : undefined,
        }
      }

      // Intervalo finalizado (short_break, long_break ou break)
      if (prev.isSoundEnabled ?? true) {
        playBreakCompleteSound()
      }

      const wasLongBreak = prev.mode === 'long_break'
      const nextCycle = wasLongBreak ? 1 : prev.currentCycle + 1
      const nextMode: PomodoroMode = 'work'
      const nextTime = prev.workDuration

      notify('Intervalo Finalizado! ☕', {
        body: 'Sua pausa terminou. Pronto para voltar ao foco?',
        icon: '/vite.svg',
      })

      completedTitleRef.current = '⏰ Pausa Finalizada! Pronto para Estudar? | Organy'
      setIsUserPaused(false)

      callbacksRef.current.onSessionCompleted?.({
        taskId: prev.taskId,
        taskTitle: prev.taskTitle,
        mode: prev.mode,
        durationMinutes: Math.round(
          (wasLongBreak ? prev.longBreakDuration : prev.breakDuration) / 60
        ),
        completedAt: new Date().toISOString(),
      })

      callbacksRef.current.onActiveSessionChange?.(null)

      if (prev.autoStartFocus) {
        setTimeout(() => {
          triggerAutoTransition('work')
        }, 0)
      }

      return {
        ...prev,
        currentCycle: nextCycle,
        mode: nextMode,
        timeLeft: nextTime,
        isRunning: false,
        isAutoTransitioning: prev.autoStartFocus,
        autoTransitionSecondsLeft: prev.autoStartFocus ? 5 : undefined,
      }
    })
  }, [triggerAutoTransition])

  // Ticker de alta precisão baseado em Date.now() delta
  const tick = useCallback(() => {
    if (!targetEndTimeRef.current) return

    const now = Date.now()
    const diffMs = targetEndTimeRef.current - now
    const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000))

    if (remainingSeconds <= 0) {
      handleCycleComplete()
    } else {
      setSession((prev) => {
        if (prev.timeLeft === remainingSeconds) return prev
        return {
          ...prev,
          timeLeft: remainingSeconds,
        }
      })
    }
  }, [handleCycleComplete])

  const timeLeftRef = useRef(session.timeLeft)
  useEffect(() => {
    timeLeftRef.current = session.timeLeft
  }, [session.timeLeft])

  // Cronômetro principal com Web Worker e fallback para setInterval
  useEffect(() => {
    if (!session.isRunning) {
      targetEndTimeRef.current = null
      return
    }

    if (!targetEndTimeRef.current) {
      targetEndTimeRef.current = Date.now() + timeLeftRef.current * 1000
    }

    let workerTimer: {
      start: () => void
      stop: () => void
      terminate: () => void
    } | null = null
    let fallbackInterval: ReturnType<typeof setInterval> | null = null

    try {
      if (
        typeof window !== 'undefined' &&
        typeof Worker !== 'undefined' &&
        typeof Blob !== 'undefined' &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      ) {
        const workerBlob = new Blob(
          [
            `let timer = null;
            self.onmessage = function(e) {
              if (e.data === 'start') {
                if (timer) clearInterval(timer);
                timer = setInterval(() => self.postMessage('tick'), 1000);
              } else if (e.data === 'stop') {
                if (timer) clearInterval(timer);
                timer = null;
              }
            };`,
          ],
          { type: 'application/javascript' }
        )
        const workerUrl = URL.createObjectURL(workerBlob)
        const worker = new Worker(workerUrl)
        worker.onmessage = (e) => {
          if (e.data === 'tick') {
            tick()
          }
        }
        workerTimer = {
          start: () => worker.postMessage('start'),
          stop: () => worker.postMessage('stop'),
          terminate: () => {
            worker.terminate()
            URL.revokeObjectURL(workerUrl)
          },
        }
        workerTimer.start()
      }
    } catch {
      workerTimer = null
    }

    if (!workerTimer) {
      fallbackInterval = setInterval(() => {
        tick()
      }, 1000)
    }

    return () => {
      if (workerTimer) {
        workerTimer.stop()
        workerTimer.terminate()
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval)
      }
    }
  }, [session.isRunning, tick])

  // Sincronização imediata ao reativar aba do navegador ou desbloquear a tela
  useEffect(() => {
    const handleSyncOnResume = () => {
      if (session.isRunning && targetEndTimeRef.current) {
        tick()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleSyncOnResume)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSyncOnResume)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleSyncOnResume)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSyncOnResume)
      }
    }
  }, [session.isRunning, tick])

  const startFocus = useCallback(
    (taskId?: string, taskTitle?: string) => {
      cancelAutoTransition()
      completedTitleRef.current = null
      setIsUserPaused(false)
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'default'
      ) {
        requestPermission().catch(() => {})
      }
      setSession((prev) => {
        const durationSeconds = prev.timeLeft
        targetEndTimeRef.current = Date.now() + durationSeconds * 1000
        const activeState: ActivePomodoroSession = {
          taskId: taskId !== undefined ? taskId : prev.taskId,
          taskTitle: taskTitle !== undefined ? taskTitle : prev.taskTitle,
          mode: prev.mode,
          startedAt: new Date().toISOString(),
          durationSeconds,
          isRunning: true,
          pausedTimeLeft: null,
        }
        callbacksRef.current.onActiveSessionChange?.(activeState)
        return {
          ...prev,
          taskId: taskId ?? prev.taskId,
          taskTitle: taskTitle ?? prev.taskTitle,
          isRunning: true,
          isAutoTransitioning: false,
          autoTransitionSecondsLeft: undefined,
        }
      })
    },
    [cancelAutoTransition]
  )

  const pauseFocus = useCallback(() => {
    cancelAutoTransition()
    targetEndTimeRef.current = null
    completedTitleRef.current = null
    setIsUserPaused(true)
    setSession((prev) => {
      const duration =
        prev.mode === 'work'
          ? prev.workDuration
          : prev.mode === 'long_break'
            ? prev.longBreakDuration
            : prev.breakDuration

      const activeState: ActivePomodoroSession = {
        taskId: prev.taskId,
        taskTitle: prev.taskTitle,
        mode: prev.mode,
        startedAt: null,
        durationSeconds: duration,
        isRunning: false,
        pausedTimeLeft: prev.timeLeft,
      }
      callbacksRef.current.onActiveSessionChange?.(activeState)
      return {
        ...prev,
        isRunning: false,
        isAutoTransitioning: false,
        autoTransitionSecondsLeft: undefined,
      }
    })
  }, [cancelAutoTransition])

  const resumeFocus = useCallback(() => {
    cancelAutoTransition()
    completedTitleRef.current = null
    setIsUserPaused(false)
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'default'
    ) {
      requestPermission().catch(() => {})
    }
    setSession((prev) => {
      const durationSeconds = prev.timeLeft
      targetEndTimeRef.current = Date.now() + durationSeconds * 1000
      const activeState: ActivePomodoroSession = {
        taskId: prev.taskId,
        taskTitle: prev.taskTitle,
        mode: prev.mode,
        startedAt: new Date().toISOString(),
        durationSeconds,
        isRunning: true,
        pausedTimeLeft: null,
      }
      callbacksRef.current.onActiveSessionChange?.(activeState)
      return {
        ...prev,
        isRunning: true,
        isAutoTransitioning: false,
        autoTransitionSecondsLeft: undefined,
      }
    })
  }, [cancelAutoTransition])

  const resetTimer = useCallback(() => {
    cancelAutoTransition()
    targetEndTimeRef.current = null
    completedTitleRef.current = null
    setIsUserPaused(false)
    if (typeof document !== 'undefined') {
      document.title = originalTitleRef.current
    }
    callbacksRef.current.onActiveSessionChange?.(null)
    setSession((prev) => {
      const nextTime =
        prev.mode === 'work'
          ? prev.workDuration
          : prev.mode === 'long_break'
            ? prev.longBreakDuration
            : prev.breakDuration

      return {
        ...prev,
        isRunning: false,
        isAutoTransitioning: false,
        autoTransitionSecondsLeft: undefined,
        timeLeft: nextTime,
      }
    })
  }, [cancelAutoTransition])

  const switchMode = useCallback(
    (mode: PomodoroMode) => {
      cancelAutoTransition()
      targetEndTimeRef.current = null
      completedTitleRef.current = null
      setIsUserPaused(false)
      if (typeof document !== 'undefined') {
        document.title = originalTitleRef.current
      }
      callbacksRef.current.onActiveSessionChange?.(null)
      setSession((prev) => {
        const nextTime =
          mode === 'work'
            ? prev.workDuration
            : mode === 'long_break'
              ? prev.longBreakDuration
              : prev.breakDuration

        return {
          ...prev,
          mode,
          isRunning: false,
          isAutoTransitioning: false,
          autoTransitionSecondsLeft: undefined,
          timeLeft: nextTime,
        }
      })
    },
    [cancelAutoTransition]
  )

  const clearFocusedTask = useCallback(() => {
    setSession((prev) => {
      if (prev.isRunning) {
        callbacksRef.current.onActiveSessionChange?.({
          taskId: null,
          taskTitle: null,
          mode: prev.mode,
          startedAt: new Date().toISOString(),
          durationSeconds: prev.timeLeft,
          isRunning: true,
          pausedTimeLeft: null,
        })
      }
      return {
        ...prev,
        taskId: null,
        taskTitle: undefined,
      }
    })
  }, [])

  const completeFocusSession = useCallback(
    (taskId?: string) => {
      cancelAutoTransition()
      targetEndTimeRef.current = null
      setIsUserPaused(false)

      setSession((prev) => {
        const targetTaskId = taskId || prev.taskId
        const isWorkEnding = prev.mode === 'work'
        const minutesWorked = isWorkEnding
          ? Math.max(1, Math.round((prev.workDuration - prev.timeLeft) / 60))
          : Math.max(
              1,
              Math.round(
                ((prev.mode === 'long_break'
                  ? prev.longBreakDuration
                  : prev.breakDuration) -
                  prev.timeLeft) /
                  60
              )
            )

        if (prev.isSoundEnabled ?? true) {
          playWorkCompleteSound()
        }

        const isLongBreak = prev.currentCycle >= prev.totalCycles
        const nextMode: PomodoroMode = isLongBreak ? 'long_break' : 'short_break'
        const nextTime = isLongBreak ? prev.longBreakDuration : prev.breakDuration

        notify('Foco Concluído! 🎉', {
          body: 'Tarefa finalizada com sucesso! Aproveite sua pausa.',
          icon: '/vite.svg',
        })

        completedTitleRef.current = isLongBreak
          ? '🌟 Pausa Longa Merecida! | Organy'
          : '🎉 Foco Concluído! Parabéns! | Organy'

        try {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7 },
          })
        } catch {
          // Silencia falhas de renderização de canvas
        }

        if (targetTaskId && callbacksRef.current.onTaskMinuteLogged) {
          callbacksRef.current.onTaskMinuteLogged(targetTaskId, minutesWorked)
        }

        callbacksRef.current.onSessionCompleted?.({
          taskId: targetTaskId,
          taskTitle: prev.taskTitle,
          mode: prev.mode,
          durationMinutes: minutesWorked,
          completedAt: new Date().toISOString(),
        })

        callbacksRef.current.onActiveSessionChange?.(null)

        return {
          ...prev,
          taskId: null,
          taskTitle: undefined,
          mode: nextMode,
          timeLeft: nextTime,
          isRunning: false,
          isAutoTransitioning: false,
          autoTransitionSecondsLeft: undefined,
        }
      })
    },
    [cancelAutoTransition]
  )

  const restoreActiveSession = useCallback((persisted: ActivePomodoroSession | null) => {
    if (!persisted) return

    completedTitleRef.current = null

    if (persisted.isRunning && persisted.startedAt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(persisted.startedAt).getTime()) / 1000
      )
      const remainingSeconds = Math.max(0, persisted.durationSeconds - elapsed)

      if (remainingSeconds > 0) {
        targetEndTimeRef.current = Date.now() + remainingSeconds * 1000
        setIsUserPaused(false)
        setSession((prev) => ({
          ...prev,
          taskId: persisted.taskId,
          taskTitle: persisted.taskTitle ?? undefined,
          mode: persisted.mode,
          timeLeft: remainingSeconds,
          isRunning: true,
        }))
      } else {
        // A contagem terminou enquanto o usuário estava longe ou trocou de máquina
        targetEndTimeRef.current = null
        setIsUserPaused(false)
        const isWorkEnding = persisted.mode === 'work'
        const nextMode: PomodoroMode = isWorkEnding ? 'short_break' : 'work'

        callbacksRef.current.onSessionCompleted?.({
          taskId: persisted.taskId,
          taskTitle: persisted.taskTitle,
          mode: persisted.mode,
          durationMinutes: Math.round(persisted.durationSeconds / 60),
          completedAt: new Date().toISOString(),
        })

        callbacksRef.current.onActiveSessionChange?.(null)

        setSession((prev) => ({
          ...prev,
          taskId: isWorkEnding ? prev.taskId : null,
          taskTitle: isWorkEnding ? prev.taskTitle : undefined,
          mode: nextMode,
          timeLeft: nextMode === 'work' ? prev.workDuration : prev.breakDuration,
          isRunning: false,
        }))
      }
    } else {
      targetEndTimeRef.current = null
      const timeLeft =
        typeof persisted.pausedTimeLeft === 'number'
          ? persisted.pausedTimeLeft
          : persisted.durationSeconds

      setIsUserPaused(true)
      setSession((prev) => ({
        ...prev,
        taskId: persisted.taskId,
        taskTitle: persisted.taskTitle ?? undefined,
        mode: persisted.mode,
        timeLeft,
        isRunning: false,
      }))
    }
  }, [])

  const updateDurations = useCallback(
    (workMinutes: number, breakMinutes: number, longBreakMinutes?: number) => {
      const newWorkDuration = Math.max(1, Math.round(workMinutes)) * 60
      const newBreakDuration = Math.max(1, Math.round(breakMinutes)) * 60
      const newLongBreakDuration =
        longBreakMinutes !== undefined
          ? Math.max(1, Math.round(longBreakMinutes)) * 60
          : undefined

      setSession((prev) => {
        const finalLongBreak = newLongBreakDuration ?? prev.longBreakDuration
        const nextTime = !prev.isRunning
          ? prev.mode === 'work'
            ? newWorkDuration
            : prev.mode === 'long_break'
              ? finalLongBreak
              : newBreakDuration
          : prev.timeLeft

        const updated: PomodoroSession = {
          ...prev,
          workDuration: newWorkDuration,
          breakDuration: newBreakDuration,
          longBreakDuration: finalLongBreak,
          timeLeft: nextTime,
        }

        try {
          localStorage.setItem(
            POMODORO_SETTINGS_KEY,
            JSON.stringify({
              workDuration: newWorkDuration,
              breakDuration: newBreakDuration,
              longBreakDuration: finalLongBreak,
              totalCycles: updated.totalCycles,
              longBreakCycles: updated.totalCycles,
              autoStartBreaks: updated.autoStartBreaks,
              autoStartFocus: updated.autoStartFocus,
              strictFocusMode: updated.strictFocusMode,
              isSoundEnabled: updated.isSoundEnabled ?? true,
            })
          )
        } catch {
          // Ignora falhas de escrita
        }

        return updated
      })
    },
    []
  )

  const toggleSound = useCallback(() => {
    setSession((prev) => {
      const nextSound = !(prev.isSoundEnabled ?? true)
      try {
        localStorage.setItem(
          POMODORO_SETTINGS_KEY,
          JSON.stringify({
            workDuration: prev.workDuration,
            breakDuration: prev.breakDuration,
            longBreakDuration: prev.longBreakDuration,
            totalCycles: prev.totalCycles,
            longBreakCycles: prev.totalCycles,
            autoStartBreaks: prev.autoStartBreaks,
            autoStartFocus: prev.autoStartFocus,
            strictFocusMode: prev.strictFocusMode,
            isSoundEnabled: nextSound,
          })
        )
      } catch {
        // Ignora falhas de escrita
      }
      return {
        ...prev,
        isSoundEnabled: nextSound,
      }
    })
  }, [])

  const updateSettings = useCallback(
    (
      paramsOrWorkMinutes: PomodoroSettingsParams | number,
      legacyBreakMinutes?: number,
      legacyIsSoundEnabled?: boolean,
      _legacyCatPurrType?: any,
      _legacyCatPurrVolume?: any
    ) => {
      setSession((prev) => {
        let workMins = Math.round(prev.workDuration / 60)
        let breakMins = Math.round(prev.breakDuration / 60)
        let longBreakMins = Math.round(prev.longBreakDuration / 60)
        let cycles = prev.totalCycles
        let autoBreaks = prev.autoStartBreaks
        let autoFocus = prev.autoStartFocus
        let strictFocus = prev.strictFocusMode
        let sound = prev.isSoundEnabled ?? true

        if (typeof paramsOrWorkMinutes === 'object' && paramsOrWorkMinutes !== null) {
          if (paramsOrWorkMinutes.workMinutes !== undefined) {
            workMins = Math.max(1, Math.round(paramsOrWorkMinutes.workMinutes))
          }
          if (paramsOrWorkMinutes.breakMinutes !== undefined) {
            breakMins = Math.max(1, Math.round(paramsOrWorkMinutes.breakMinutes))
          }
          if (paramsOrWorkMinutes.longBreakMinutes !== undefined) {
            longBreakMins = Math.max(1, Math.round(paramsOrWorkMinutes.longBreakMinutes))
          }
          if (paramsOrWorkMinutes.longBreakCycles !== undefined) {
            cycles = Math.max(1, Math.round(paramsOrWorkMinutes.longBreakCycles))
          }
          if (paramsOrWorkMinutes.autoStartBreaks !== undefined) {
            autoBreaks = paramsOrWorkMinutes.autoStartBreaks
          }
          if (paramsOrWorkMinutes.autoStartFocus !== undefined) {
            autoFocus = paramsOrWorkMinutes.autoStartFocus
          }
          if (paramsOrWorkMinutes.strictFocusMode !== undefined) {
            strictFocus = paramsOrWorkMinutes.strictFocusMode
          }
          if (paramsOrWorkMinutes.isSoundEnabled !== undefined) {
            sound = paramsOrWorkMinutes.isSoundEnabled
          }
        } else if (typeof paramsOrWorkMinutes === 'number') {
          workMins = Math.max(1, Math.round(paramsOrWorkMinutes))
          if (legacyBreakMinutes !== undefined) {
            breakMins = Math.max(1, Math.round(legacyBreakMinutes))
          }
          if (legacyIsSoundEnabled !== undefined) {
            sound = legacyIsSoundEnabled
          }
        }

        const newWorkDuration = workMins * 60
        const newBreakDuration = breakMins * 60
        const newLongBreakDuration = longBreakMins * 60

        const nextTime = !prev.isRunning
          ? prev.mode === 'work'
            ? newWorkDuration
            : prev.mode === 'long_break'
              ? newLongBreakDuration
              : newBreakDuration
          : prev.timeLeft

        const updated: PomodoroSession = {
          ...prev,
          workDuration: newWorkDuration,
          breakDuration: newBreakDuration,
          longBreakDuration: newLongBreakDuration,
          totalCycles: cycles,
          autoStartBreaks: autoBreaks,
          autoStartFocus: autoFocus,
          strictFocusMode: strictFocus,
          isSoundEnabled: sound,
          timeLeft: nextTime,
        }

        try {
          localStorage.setItem(
            POMODORO_SETTINGS_KEY,
            JSON.stringify({
              workDuration: newWorkDuration,
              breakDuration: newBreakDuration,
              longBreakDuration: newLongBreakDuration,
              totalCycles: cycles,
              longBreakCycles: cycles,
              autoStartBreaks: autoBreaks,
              autoStartFocus: autoFocus,
              strictFocusMode: strictFocus,
              isSoundEnabled: sound,
            })
          )
        } catch {
          // Ignora falhas de escrita
        }

        return updated
      })
    },
    []
  )

  return {
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
  }
}
