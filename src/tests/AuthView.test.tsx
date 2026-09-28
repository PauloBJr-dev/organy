import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthView } from '../views/AuthView'
import * as useAuthModule from '../hooks/useAuth'
import { migrationService } from '../services/migrationService'
import type { User } from '@supabase/supabase-js'

describe('AuthView Component', () => {
  const mockSignUpWithPassword = vi.fn().mockResolvedValue({ error: null })
  const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null })
  const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
  const mockContinueAsGuest = vi.fn()
  const mockOnBackToBoard = vi.fn()
  const mockOnSuccess = vi.fn()

  const defaultAuthValue = {
    user: null,
    session: null,
    loading: false,
    isConfigured: true,
    authModalInitialTab: undefined as 'signin' | 'signup' | undefined,
    isPasswordRecovery: false,
    setIsPasswordRecovery: vi.fn(),
    signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUpWithPassword: mockSignUpWithPassword,
    signInWithPassword: mockSignInWithPassword,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUserPassword: vi.fn().mockResolvedValue({ error: null }),
    continueAsGuest: mockContinueAsGuest,
    isGuestAcknowledged: false,
    isAuthModalOpen: false,
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    mockSignUpWithPassword.mockClear()
    mockSignInWithPassword.mockClear()
    mockResetPasswordForEmail.mockClear()
    mockContinueAsGuest.mockClear()
    mockOnBackToBoard.mockClear()
    mockOnSuccess.mockClear()

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ ...defaultAuthValue })
  })

  it('renderiza o painel de branding Organy com badge, logotipo, slogan e os 4 pilares', () => {
    render(<AuthView />)

    // Branding
    expect(screen.getByText(/plataforma de produtividade acadêmica/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Organy' })).toBeInTheDocument()
    expect(screen.getByText(/organize e estude com clareza e foco/i)).toBeInTheDocument()

    // 4 Pilares
    expect(screen.getByText('Gestão de blocos & rotina')).toBeInTheDocument()
    expect(screen.getByText('Foco profundo sem distrações')).toBeInTheDocument()
    expect(screen.getByText('Ciclos de estudo acadêmico')).toBeInTheDocument()
    expect(screen.getByText('Privacidade com Modo Local')).toBeInTheDocument()
  })

  it('alterna suavemente entre as abas Criar Conta e Entrar', () => {
    render(<AuthView initialTab="signup" />)

    // Inicialmente na aba Criar Conta
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /suas tarefas e anotações criadas neste navegador serão sincronizadas/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /criar conta e começar/i })
    ).toBeInTheDocument()

    // Alterna para Entrar
    const signinTab = screen.getByRole('tab', { name: 'Entrar' })
    fireEvent.click(signinTab)

    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Esqueceu sua senha?' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar na conta/i })).toBeInTheDocument()
  })

  it('calcula e exibe a força da senha na aba Criar Conta', () => {
    render(<AuthView initialTab="signup" />)

    const passwordInput = screen.getByLabelText(/^senha$/i)
    fireEvent.change(passwordInput, { target: { value: '123' } })
    expect(screen.getByText('Fraca')).toBeInTheDocument()

    fireEvent.change(passwordInput, { target: { value: 'MinhaSenhaForte@2026' } })
    expect(screen.getByText('Forte')).toBeInTheDocument()
  })

  it('transiciona inline para o formulário de "Esqueceu sua senha?" e envia link com sucesso', async () => {
    render(<AuthView initialTab="signin" />)

    // Clica em "Esqueceu sua senha?"
    const forgotBtn = screen.getByRole('button', { name: 'Esqueceu sua senha?' })
    fireEvent.click(forgotBtn)

    // Verifica transição inline para Recuperar Senha
    expect(screen.getByRole('heading', { name: 'Recuperar Senha' })).toBeInTheDocument()
    expect(
      screen.getByText(/digite seu e-mail para enviarmos o link seguro de redefinição/i)
    ).toBeInTheDocument()

    // Preenche e-mail e envia
    const emailInput = screen.getByLabelText(/e-mail acadêmico ou pessoal/i)
    fireEvent.change(emailInput, { target: { value: 'aluno@universidade.edu' } })

    const submitBtn = screen.getByRole('button', { name: /enviar link de recuperação/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('aluno@universidade.edu')
      expect(
        screen.getByText(/link de recuperação enviado com sucesso!/i)
      ).toBeInTheDocument()
    })

    // Botão de retornar ao login
    const backToLoginBtn = screen.getByRole('button', { name: /ir para o login/i })
    fireEvent.click(backToLoginBtn)
    expect(screen.getByRole('button', { name: /entrar na conta/i })).toBeInTheDocument()
  })

  it('abre o GuestModeWarningModal ao clicar em "Continuar sem Conta (Modo Convidado)"', () => {
    render(<AuthView />)

    const guestBtn = screen.getByRole('button', {
      name: /continuar sem conta/i,
    })
    fireEvent.click(guestBtn)

    // Modal de aviso aberto
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /o que é armazenamento local?/i })
    ).toBeInTheDocument()
  })

  it('exibe o botão "Voltar ao quadro" e chama onBackToBoard quando showBackToBoard for true', () => {
    render(<AuthView showBackToBoard={true} onBackToBoard={mockOnBackToBoard} />)

    const backToBoardBtn = screen.getByRole('button', { name: /voltar ao quadro/i })
    expect(backToBoardBtn).toBeInTheDocument()

    fireEvent.click(backToBoardBtn)
    expect(mockOnBackToBoard).toHaveBeenCalledTimes(1)
  })

  it('não exibe o botão "Voltar ao quadro" quando showBackToBoard for false', () => {
    render(<AuthView showBackToBoard={false} onBackToBoard={mockOnBackToBoard} />)
    expect(
      screen.queryByRole('button', { name: /voltar ao quadro/i })
    ).not.toBeInTheDocument()
  })

  it('passa o UUID real do usuário retornado por signInWithPassword para a migração ao invés de migrated_user', async () => {
    vi.spyOn(migrationService, 'hasGuestDataToMigrate').mockReturnValue(true)
    const executeMigrationSpy = vi
      .spyOn(migrationService, 'executeMigration')
      .mockResolvedValue({
        success: true,
      })

    const realUser: User = {
      id: 'uuid-usuario-real-1234',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'aluno@universidade.edu',
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    }

    mockSignInWithPassword.mockResolvedValueOnce({
      error: null,
      user: realUser,
    })

    render(<AuthView initialTab="signin" />)

    const emailInput = screen.getByLabelText(/e-mail acadêmico ou pessoal/i)
    const passwordInput = screen.getByLabelText(/^senha$/i)

    fireEvent.change(emailInput, { target: { value: 'aluno@universidade.edu' } })
    fireEvent.change(passwordInput, { target: { value: 'MinhaSenha@123' } })

    const submitBtn = screen.getByRole('button', { name: /entrar na conta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(executeMigrationSpy).toHaveBeenCalledWith(
        'uuid-usuario-real-1234',
        expect.any(Function),
        undefined
      )
      expect(executeMigrationSpy).not.toHaveBeenCalledWith(
        'migrated_user',
        expect.any(Function),
        undefined
      )
    })
  })

  it('passa o UUID real do usuário retornado por signUpWithPassword para a migração ao invés de migrated_user', async () => {
    vi.spyOn(migrationService, 'hasGuestDataToMigrate').mockReturnValue(true)
    const executeMigrationSpy = vi
      .spyOn(migrationService, 'executeMigration')
      .mockResolvedValue({
        success: true,
      })

    const realUser: User = {
      id: 'uuid-novo-usuario-5678',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'novo@universidade.edu',
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    }

    mockSignUpWithPassword.mockResolvedValueOnce({
      error: null,
      user: realUser,
    })

    render(<AuthView initialTab="signup" />)

    const nameInput = screen.getByLabelText(/nome completo/i)
    const emailInput = screen.getByLabelText(/e-mail acadêmico ou pessoal/i)
    const passwordInput = screen.getByLabelText(/^senha$/i)

    fireEvent.change(nameInput, { target: { value: 'Novo Aluno' } })
    fireEvent.change(emailInput, { target: { value: 'novo@universidade.edu' } })
    fireEvent.change(passwordInput, { target: { value: 'MinhaSenha@123' } })

    const submitBtn = screen.getByRole('button', { name: /criar conta e começar/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(executeMigrationSpy).toHaveBeenCalledWith(
        'uuid-novo-usuario-5678',
        expect.any(Function),
        undefined
      )
      expect(executeMigrationSpy).not.toHaveBeenCalledWith(
        'migrated_user',
        expect.any(Function),
        undefined
      )
    })
  })
})
