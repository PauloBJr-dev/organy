import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppearanceSection } from '../components/settings/AppearanceSection'

describe('AppearanceSection Component', () => {
  const defaultMatchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(false),
    }))
  })

  afterEach(() => {
    window.matchMedia = defaultMatchMedia as unknown as typeof window.matchMedia
  })

  describe('1. Renderização e Estrutura Semântica', () => {
    it('renderiza o cabeçalho da seção com título, subtítulo, ícone e semântica acessível', () => {
      render(<AppearanceSection isDark={false} onToggleTheme={vi.fn()} />)

      const section = document.getElementById('aparencia')
      expect(section).toBeInTheDocument()
      expect(section).toHaveAttribute('aria-labelledby', 'settings-appearance-title')

      const title = screen.getByRole('heading', { level: 2, name: /Aparência & Tema/i })
      expect(title).toBeInTheDocument()
      expect(title).toHaveAttribute('id', 'settings-appearance-title')

      expect(screen.getByText('Escolha o tema visual do aplicativo')).toBeInTheDocument()
      expect(screen.getByText('Tema do Aplicativo')).toBeInTheDocument()
    })

    it('renderiza as 3 opções de tema com seus respectivos rótulos acessíveis e previews', () => {
      render(<AppearanceSection isDark={false} onToggleTheme={vi.fn()} />)

      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })
      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })

      expect(lightBtn).toBeInTheDocument()
      expect(darkBtn).toBeInTheDocument()
      expect(autoBtn).toBeInTheDocument()

      expect(screen.getByText('Claro')).toBeInTheDocument()
      expect(screen.getByText('Escuro')).toBeInTheDocument()
      expect(screen.getByText('Automático (Sistema)')).toBeInTheDocument()
    })
  })

  describe('2. Estados Visuais Ativos e Tokens de Design', () => {
    it('aplica estado visual ativo no tema Claro quando isDark=false e inativo nos demais', () => {
      const { container } = render(
        <AppearanceSection isDark={false} onToggleTheme={vi.fn()} />
      )

      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })
      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })

      // Card Claro ativo
      expect(lightBtn.className).toContain('border-blue-600')
      expect(lightBtn.className).toContain('bg-blue-50/20')
      expect(lightBtn.className).toContain('shadow-xs')

      // Cards Escuro e Automático inativos
      expect(darkBtn.className).toContain('border-slate-200')
      expect(autoBtn.className).toContain('border-slate-200')

      // Ícone CheckCircle2 presente apenas no card Claro
      const checkIcons = container.querySelectorAll('.lucide-check-circle-2')
      expect(checkIcons).toHaveLength(1)
      expect(lightBtn).toContainElement(checkIcons[0] as HTMLElement)
    })

    it('aplica estado visual ativo no tema Escuro quando isDark=true e inativo nos demais', () => {
      const { container } = render(
        <AppearanceSection isDark={true} onToggleTheme={vi.fn()} />
      )

      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })
      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })

      // Card Escuro ativo
      expect(darkBtn.className).toContain('border-blue-600')
      expect(darkBtn.className).toContain('bg-blue-50/20')
      expect(darkBtn.className).toContain('shadow-xs')

      // Cards Claro e Automático inativos
      expect(lightBtn.className).toContain('border-slate-200')
      expect(autoBtn.className).toContain('border-slate-200')

      // Ícone CheckCircle2 presente apenas no card Escuro
      const checkIcons = container.querySelectorAll('.lucide-check-circle-2')
      expect(checkIcons).toHaveLength(1)
      expect(darkBtn).toContainElement(checkIcons[0] as HTMLElement)
    })

    it('exibe círculos vazios como placeholders nos temas inativos', () => {
      const { container } = render(
        <AppearanceSection isDark={false} onToggleTheme={vi.fn()} />
      )

      const emptyCircles = container.querySelectorAll('span.w-4.h-4.rounded-full.border')
      // 2 temas inativos (Escuro e Automático) devem ter o círculo vazio
      expect(emptyCircles).toHaveLength(2)
    })

    it('contém classes dark mode adequadas na seção e nos componentes internos', () => {
      render(<AppearanceSection isDark={false} onToggleTheme={vi.fn()} />)

      const section = document.getElementById('aparencia')
      expect(section?.className).toContain('dark:bg-slate-900')
      expect(section?.className).toContain('dark:border-slate-800')

      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      expect(darkBtn.className).toContain('dark:border-slate-800')
      expect(darkBtn.className).toContain('dark:hover:border-slate-700')
    })
  })

  describe('3. Comportamento de Interação e Seleção de Tema', () => {
    it('chama onToggleTheme ao clicar em Tema Escuro quando o tema atual for Claro', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      fireEvent.click(darkBtn)

      expect(onToggleTheme).toHaveBeenCalledTimes(1)
    })

    it('NÃO chama onToggleTheme ao clicar em Tema Claro quando o tema atual já for Claro', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })
      fireEvent.click(lightBtn)

      expect(onToggleTheme).not.toHaveBeenCalled()
    })

    it('chama onToggleTheme ao clicar em Tema Claro quando o tema atual for Escuro', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={true} onToggleTheme={onToggleTheme} />)

      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })
      fireEvent.click(lightBtn)

      expect(onToggleTheme).toHaveBeenCalledTimes(1)
    })

    it('NÃO chama onToggleTheme ao clicar em Tema Escuro quando o tema atual já for Escuro', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={true} onToggleTheme={onToggleTheme} />)

      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })
      fireEvent.click(darkBtn)

      expect(onToggleTheme).not.toHaveBeenCalled()
    })
  })

  describe('4. Comportamento do Modo Automático (Sistema)', () => {
    it('ativa o card Automático e dispara onToggleTheme se o sistema preferir escuro e o app for claro', () => {
      // Sistema prefere dark
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(false),
      }))

      const onToggleTheme = vi.fn()
      const { container } = render(
        <AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />
      )

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      fireEvent.click(autoBtn)

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
      expect(onToggleTheme).toHaveBeenCalledTimes(1)

      // Card Automático deve ficar ativo
      expect(autoBtn.className).toContain('border-blue-600')
      const checkIcons = container.querySelectorAll('.lucide-check-circle-2')
      expect(checkIcons).toHaveLength(1)
      expect(autoBtn).toContainElement(checkIcons[0] as HTMLElement)
    })

    it('ativa o card Automático e NÃO dispara onToggleTheme se o sistema e o app já estiverem em sintonia (dark)', () => {
      // Sistema prefere dark e app já é dark
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(false),
      }))

      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={true} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      fireEvent.click(autoBtn)

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
      expect(onToggleTheme).not.toHaveBeenCalled()
      expect(autoBtn.className).toContain('border-blue-600')
    })

    it('ativa o card Automático e dispara onToggleTheme se o sistema preferir claro e o app for escuro', () => {
      // Sistema prefere light
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(false),
      }))

      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={true} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      fireEvent.click(autoBtn)

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
      expect(onToggleTheme).toHaveBeenCalledTimes(1)
      expect(autoBtn.className).toContain('border-blue-600')
    })

    it('ativa o card Automático e NÃO dispara onToggleTheme se o sistema e o app já forem claros', () => {
      // Sistema prefere light e app já é claro
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(false),
      }))

      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      fireEvent.click(autoBtn)

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
      expect(onToggleTheme).not.toHaveBeenCalled()
      expect(autoBtn.className).toContain('border-blue-600')
    })

    it('lida com segurança caso window.matchMedia seja indefinido', () => {
      // Simula navegador antigo sem matchMedia
      // @ts-expect-error testando ausência de matchMedia
      window.matchMedia = undefined

      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      expect(() => fireEvent.click(autoBtn)).not.toThrow()
      expect(onToggleTheme).not.toHaveBeenCalled()
      expect(autoBtn.className).toContain('border-blue-600')
    })

    it('desativa o modo Automático ao selecionar manualmente o Tema Claro ou Escuro', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      const lightBtn = screen.getByRole('button', { name: 'Selecionar Tema Claro' })

      // Seleciona auto
      fireEvent.click(autoBtn)
      expect(autoBtn.className).toContain('border-blue-600')

      // Volta para Claro manual
      fireEvent.click(lightBtn)
      expect(autoBtn.className).not.toContain('border-blue-600')
      expect(lightBtn.className).toContain('border-blue-600')
    })

    it('desativa o modo Automático e chama onToggleTheme ao selecionar Tema Escuro quando isDark=false', () => {
      const onToggleTheme = vi.fn()
      render(<AppearanceSection isDark={false} onToggleTheme={onToggleTheme} />)

      const autoBtn = screen.getByRole('button', { name: 'Selecionar Tema Automático' })
      const darkBtn = screen.getByRole('button', { name: 'Selecionar Tema Escuro' })

      // Seleciona auto
      fireEvent.click(autoBtn)

      // Seleciona Escuro manual
      fireEvent.click(darkBtn)
      expect(onToggleTheme).toHaveBeenCalledTimes(1)
      expect(autoBtn.className).not.toContain('border-blue-600')
    })
  })

  describe('5. Fidelidade Visual das Miniaturas de Tema (Previews)', () => {
    it('renderiza os containers visuais com as cores de tema corretas', () => {
      const { container } = render(
        <AppearanceSection isDark={false} onToggleTheme={vi.fn()} />
      )

      // Preview Claro deve conter o fundo característico #faf8ff
      const lightPreview = container.querySelector('.bg-\\[\\#faf8ff\\]')
      expect(lightPreview).toBeInTheDocument()

      // Preview Escuro deve conter o fundo escuro #191b23
      const darkPreview = container.querySelector('.bg-\\[\\#191b23\\]')
      expect(darkPreview).toBeInTheDocument()
    })
  })
})
