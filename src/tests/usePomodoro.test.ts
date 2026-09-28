import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePomodoro, POMODORO_SETTINGS_KEY } from '../hooks/usePomodoro'
import * as soundService from '../services/soundService'
import * as notificationService from '../services/notificationService'
import confetti from 'canvas-confetti'

vi.mock('../services/soundService', () => ({
  playWorkCompleteSound: vi.fn(),
  playBreakCompleteSound: vi.fn(),
  startCatPurr: vi.fn(),
  stopCatPurr: vi.fn(),
  soundService: {
    playWorkCompleteSound: vi.fn(),
    playBreakCompleteSound: vi.fn(),
    startCatPurr: vi.fn(),
    stopCatPurr: vi.fn(),
    previewCatPurr: vi.fn(),
  },
}))

vi.mock('../services/notificationService', () => ({
  notify: vi.fn(),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
  notificationService: {
    notify: vi.fn(),
    isSupported: vi.fn(() => true),
    getPermission: vi.fn(() => 'granted'),
    requestPermission: vi.fn(() => Promise.resolve('granted')),
  },
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('usePomodoro hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    document.title = 'Organy - Organização e estudos'
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('inicializa com valores padrão quando localStorage está vazio', () => {
    const { result } = renderHook(() => usePomodoro())

    expect(result.current.session.timeLeft).toBe(25 * 60)
    expect(result.current.session.workDuration).toBe(25 * 60)
    expect(result.current.session.breakDuration).toBe(5 * 60)
    expect(result.current.session.isRunning).toBe(false)
    expect(result.current.session.mode).toBe('work')
    expect(result.current.session.isSoundEnabled).toBe(true)
  })

  it('inicializa com configurações customizadas salvas no localStorage', () => {
    localStorage.setItem(
      POMODORO_SETTINGS_KEY,
      JSON.stringify({
        workDuration: 30 * 60,
        breakDuration: 10 * 60,
        isSoundEnabled: false,
      })
    )

    const { result } = renderHook(() => usePomodoro())

    expect(result.current.session.timeLeft).toBe(30 * 60)
    expect(result.current.session.workDuration).toBe(30 * 60)
    expect(result.current.session.breakDuration).toBe(10 * 60)
    expect(result.current.session.isSoundEnabled).toBe(false)
  })

  it('atualiza o document.title em tempo real enquanto o cronômetro estiver rodando no modo foco', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.startFocus('task-1', 'Tarefa Teste')
    })

    expect(document.title).toBe('(25:00) 📖 Tarefa Teste | Organy')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(document.title).toBe('(24:59) 📖 Tarefa Teste | Organy')

    act(() => {
      result.current.pauseFocus()
    })

    expect(document.title).toBe('⏸️ (24:59) Pausado | Organy')

    act(() => {
      result.current.resetTimer()
    })

    expect(document.title).toBe('Organy - Organização e estudos')
  })

  it('atualiza o document.title em tempo real no modo pausa e restaura ao pausar ou reiniciar', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.switchMode('break')
      result.current.resumeFocus()
    })

    expect(document.title).toBe('(05:00) ☕ Pausa Revigorante | Organy')

    act(() => {
      result.current.resetTimer()
    })

    expect(document.title).toBe('Organy - Organização e estudos')
  })

  it('ao concluir modo foco: emite som, notificação, confetti, atualiza título e computa minutos da tarefa', () => {
    const onTaskMinuteLogged = vi.fn()
    const { result } = renderHook(() => usePomodoro(onTaskMinuteLogged))

    act(() => {
      result.current.updateSettings({ autoStartBreaks: false })
    })

    act(() => {
      result.current.startFocus('task-10', 'Finalizar Relatório')
    })

    // Avança o tempo até o fim do foco (25 minutos = 1500 segundos)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000)
    })

    expect(soundService.playWorkCompleteSound).toHaveBeenCalledTimes(1)
    expect(notificationService.notify).toHaveBeenCalledWith(
      'Pausa Curta! ☕',
      expect.objectContaining({
        body: expect.stringContaining('pausa'),
      })
    )
    expect(confetti).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('🎉 Foco Concluído! Parabéns! | Organy')
    expect(onTaskMinuteLogged).toHaveBeenCalledWith('task-10', 25)

    // Modo deve ter mudado para descanso
    expect(result.current.session.mode).toBe('short_break')
    expect(result.current.session.isRunning).toBe(false)
    expect(result.current.session.timeLeft).toBe(5 * 60)
  })

  it('ao concluir modo descanso: emite som de pausa, notificação e destaca título', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.switchMode('break')
      result.current.resumeFocus()
    })

    // Avança o tempo até o fim da pausa (5 minutos = 300 segundos)
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })

    expect(soundService.playBreakCompleteSound).toHaveBeenCalledTimes(1)
    expect(notificationService.notify).toHaveBeenCalledWith(
      'Intervalo Finalizado! ☕',
      expect.objectContaining({
        body: expect.stringContaining('pausa'),
      })
    )
    expect(document.title).toBe('⏰ Pausa Finalizada! Pronto para Estudar? | Organy')
    expect(result.current.session.mode).toBe('work')
  })

  it('não toca som se isSoundEnabled estiver desativado', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.toggleSound()
    })
    expect(result.current.session.isSoundEnabled).toBe(false)

    act(() => {
      result.current.startFocus()
      vi.advanceTimersByTime(25 * 60 * 1000)
    })

    expect(soundService.playWorkCompleteSound).not.toHaveBeenCalled()
  })

  it('atualiza durações personalizadas e atualiza timeLeft imediatamente se o cronômetro estiver parado', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.updateDurations(45, 15)
    })

    expect(result.current.session.workDuration).toBe(45 * 60)
    expect(result.current.session.breakDuration).toBe(15 * 60)
    expect(result.current.session.timeLeft).toBe(45 * 60)

    const saved = JSON.parse(localStorage.getItem(POMODORO_SETTINGS_KEY) || '{}')
    expect(saved.workDuration).toBe(45 * 60)
    expect(saved.breakDuration).toBe(15 * 60)
  })

  it('mantém precisão absoluta e avança corretamente quando há salto de tempo em segundo plano (background timer jump)', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.startFocus('task-1', 'Tarefa em Background')
    })

    expect(result.current.session.timeLeft).toBe(25 * 60)

    // Simula que a aba ficou em segundo plano por 3 minutos (180 segundos)
    act(() => {
      vi.advanceTimersByTime(3 * 60 * 1000)
    })

    expect(result.current.session.timeLeft).toBe(22 * 60)
    expect(document.title).toBe('(22:00) 📖 Tarefa em Background | Organy')
  })

  it('conclui o ciclo e dispara notificações ao receber evento visibilitychange se o tempo expirou com tela bloqueada ou aba inativa', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.updateSettings({ autoStartBreaks: false })
    })

    act(() => {
      result.current.startFocus('task-1', 'Tarefa Longa')
    })

    // Simula que o tempo passou completamente em segundo plano (26 minutos)
    act(() => {
      vi.advanceTimersByTime(26 * 60 * 1000)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(soundService.playWorkCompleteSound).toHaveBeenCalledTimes(1)
    expect(notificationService.notify).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('🎉 Foco Concluído! Parabéns! | Organy')
    expect(result.current.session.mode).toBe('short_break')
    expect(result.current.session.isRunning).toBe(false)
  })
  it('atualiza o document.title com sinal visual ⚡ nos últimos 5 segundos de foco', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.startFocus('task-1', 'Tarefa Reta Final')
    })

    // Avança 24 minutos e 55 segundos (faltam 5 segundos)
    act(() => {
      vi.advanceTimersByTime((25 * 60 - 5) * 1000)
    })

    expect(result.current.session.timeLeft).toBe(5)
    expect(document.title).toBe('⚡ (00:05) Reta Final! Quase lá! | Organy')

    // Avança mais 2 segundos (faltam 3 segundos)
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.session.timeLeft).toBe(3)
    expect(document.title).toBe('⚡ (00:03) Reta Final! Quase lá! | Organy')
  })

  it('solicita permissão de notificação proativamente ao iniciar foco se permissão for default', () => {
    window.Notification = {
      permission: 'default',
      requestPermission: vi.fn(() =>
        Promise.resolve('granted' as NotificationPermission)
      ),
    } as unknown as typeof Notification

    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.startFocus('task-1', 'Tarefa Nova')
    })

    expect(notificationService.requestPermission).toHaveBeenCalled()
  })
  it('avança para modo pausa longa após atingir o número total de ciclos configurado', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.updateSettings({
        longBreakCycles: 2,
        longBreakMinutes: 15,
        autoStartBreaks: false,
      })
    })

    // Ciclo 1: conclui foco
    act(() => {
      result.current.startFocus('t1', 'Ciclo 1')
    })
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000)
    })
    expect(result.current.session.mode).toBe('short_break')
    expect(result.current.session.currentCycle).toBe(1)

    // Conclui pausa curta
    act(() => {
      result.current.resumeFocus()
    })
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000)
    })
    expect(result.current.session.mode).toBe('work')
    expect(result.current.session.currentCycle).toBe(2)

    // Ciclo 2: conclui foco -> deve ir para long_break
    act(() => {
      result.current.startFocus('t2', 'Ciclo 2')
    })
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000)
    })
    expect(result.current.session.mode).toBe('long_break')
    expect(result.current.session.timeLeft).toBe(15 * 60)
  })

  it('permite atualizar configurações com updateSettings persistindo no localStorage', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.updateSettings({
        workMinutes: 50,
        breakMinutes: 10,
        longBreakMinutes: 20,
        longBreakCycles: 4,
        autoStartBreaks: true,
        autoStartFocus: false,
        strictFocusMode: true,
        isSoundEnabled: true,
      })
    })

    expect(result.current.session.workDuration).toBe(50 * 60)
    expect(result.current.session.breakDuration).toBe(10 * 60)
    expect(result.current.session.longBreakDuration).toBe(20 * 60)
    expect(result.current.session.totalCycles).toBe(4)
    expect(result.current.session.autoStartBreaks).toBe(true)

    const saved = JSON.parse(localStorage.getItem(POMODORO_SETTINGS_KEY) || '{}')
    expect(saved.workDuration).toBe(50 * 60)
    expect(saved.breakDuration).toBe(10 * 60)
    expect(saved.longBreakDuration).toBe(20 * 60)
    expect(saved.totalCycles).toBe(4)
  })
  it('dispara onActiveSessionChange e onSessionCompleted durante o ciclo de vida do foco', () => {
    const onActiveSessionChange = vi.fn()
    const onSessionCompleted = vi.fn()

    const { result } = renderHook(() =>
      usePomodoro({
        onActiveSessionChange,
        onSessionCompleted,
      })
    )

    // Inicia foco
    act(() => {
      result.current.startFocus('task-123', 'Tarefa Importante')
    })

    expect(onActiveSessionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-123',
        taskTitle: 'Tarefa Importante',
        mode: 'work',
        isRunning: true,
        durationSeconds: 25 * 60,
      })
    )

    // Pausa foco
    act(() => {
      result.current.pauseFocus()
    })

    expect(onActiveSessionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-123',
        taskTitle: 'Tarefa Importante',
        mode: 'work',
        isRunning: false,
        pausedTimeLeft: 25 * 60,
      })
    )

    // Reseta timer
    act(() => {
      result.current.resetTimer()
    })

    expect(onActiveSessionChange).toHaveBeenCalledWith(null)
  })

  it('restaura contagem em andamento cross-device calculando tempo decorrido por timestamp', () => {
    const now = new Date('2026-09-14T20:10:00.000Z').getTime()
    vi.setSystemTime(now)

    const startedAt = new Date('2026-09-14T20:00:00.000Z').toISOString() // 10 minutos (600s) atrás
    const durationSeconds = 25 * 60 // 1500s total -> restam 900s (15 min)

    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.restoreActiveSession({
        taskId: 'task-pc',
        taskTitle: 'Foco no Escritório',
        mode: 'work',
        startedAt,
        durationSeconds,
        isRunning: true,
        pausedTimeLeft: null,
      })
    })

    expect(result.current.session.isRunning).toBe(true)
    expect(result.current.session.mode).toBe('work')
    expect(result.current.session.taskId).toBe('task-pc')
    expect(result.current.session.taskTitle).toBe('Foco no Escritório')
    expect(result.current.session.timeLeft).toBe(900) // 15 minutos restantes exatos
  })

  it('restaura sessão pausada cross-device preservando pausedTimeLeft', () => {
    const { result } = renderHook(() => usePomodoro())

    act(() => {
      result.current.restoreActiveSession({
        taskId: 'task-paused',
        taskTitle: 'Pausado no Notebook',
        mode: 'work',
        startedAt: null,
        durationSeconds: 25 * 60,
        isRunning: false,
        pausedTimeLeft: 420, // 7 minutos
      })
    })

    expect(result.current.session.isRunning).toBe(false)
    expect(result.current.session.mode).toBe('work')
    expect(result.current.session.taskId).toBe('task-paused')
    expect(result.current.session.timeLeft).toBe(420)
  })

  it('completa sessão automaticamente se o tempo expirou enquanto o usuário estava longe', () => {
    const now = new Date('2026-09-14T20:30:00.000Z').getTime()
    vi.setSystemTime(now)

    const startedAt = new Date('2026-09-14T20:00:00.000Z').toISOString() // 30 minutos atrás
    const durationSeconds = 25 * 60 // 25 min total -> expirou há 5 min!

    const onSessionCompleted = vi.fn()
    const { result } = renderHook(() =>
      usePomodoro({
        onSessionCompleted,
      })
    )

    act(() => {
      result.current.restoreActiveSession({
        taskId: 'task-expired',
        taskTitle: 'Foco Finalizado em Trânsito',
        mode: 'work',
        startedAt,
        durationSeconds,
        isRunning: true,
      })
    })

    expect(onSessionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-expired',
        taskTitle: 'Foco Finalizado em Trânsito',
        mode: 'work',
        durationMinutes: 25,
      })
    )
    expect(result.current.session.isRunning).toBe(false)
    expect(result.current.session.mode).toBe('short_break')
  })

  it('completeFocusSession encerra a sessão de foco, calcula minutos trabalhados e comuta para pausa curta', () => {
    const onTaskMinuteLogged = vi.fn()
    const onSessionCompleted = vi.fn()
    const onActiveSessionChange = vi.fn()

    const { result } = renderHook(() =>
      usePomodoro({
        onTaskMinuteLogged,
        onSessionCompleted,
        onActiveSessionChange,
      })
    )

    act(() => {
      result.current.startFocus('task-focus-1', 'Estudo de Algoritmos')
    })

    // Avança 10 minutos (600 segundos) de 25 minutos
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })

    act(() => {
      result.current.completeFocusSession()
    })

    // Minutos trabalhados = 10 minutos
    expect(onTaskMinuteLogged).toHaveBeenCalledWith('task-focus-1', 10)
    expect(onSessionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-focus-1',
        taskTitle: 'Estudo de Algoritmos',
        mode: 'work',
        durationMinutes: 10,
      })
    )
    expect(onActiveSessionChange).toHaveBeenCalledWith(null)
    expect(result.current.session.taskId).toBeNull()
    expect(result.current.session.taskTitle).toBeUndefined()
    expect(result.current.session.isRunning).toBe(false)
    expect(result.current.session.mode).toBe('short_break')
    expect(result.current.session.timeLeft).toBe(5 * 60)
    expect(notificationService.notify).toHaveBeenCalledWith(
      'Foco Concluído! 🎉',
      expect.objectContaining({
        body: 'Tarefa finalizada com sucesso! Aproveite sua pausa.',
      })
    )
  })

  it('completeFocusSession comuta para pausa longa quando o ciclo atual atinge totalCycles', () => {
    const onSessionCompleted = vi.fn()

    const { result } = renderHook(() =>
      usePomodoro({
        onSessionCompleted,
      })
    )

    // Ajusta o ciclo para totalCycles (4)
    act(() => {
      result.current.updateSettings({
        longBreakCycles: 4,
      })
    })

    act(() => {
      // Simula ciclo 4
      result.current.startFocus('task-cycle-4', 'Tarefa Ciclo 4')
    })

    // Forçamos o ciclo atual a ser 4
    act(() => {
      result.current.updateSettings({
        longBreakCycles: 1, // totalCycles = 1, então currentCycle (1) >= totalCycles (1)
      })
    })

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000) // 5 minutos trabalhados
    })

    act(() => {
      result.current.completeFocusSession('task-cycle-4')
    })

    expect(onSessionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-cycle-4',
        durationMinutes: 5,
      })
    )
    expect(result.current.session.mode).toBe('long_break')
    expect(result.current.session.timeLeft).toBe(15 * 60)
  })
})
