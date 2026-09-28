import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AuthProvider } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

const mockUser: User = {
  id: 'user-123',
  app_metadata: {},
  user_metadata: {
    full_name: 'Ana Silva',
    name: 'Ana Silva',
    avatar_url: 'https://lh3.googleusercontent.com/a/avatar.jpg',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'ana.silva@example.com',
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
}

const mockSession: Session = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
}

describe('AuthContext & useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('helper isSupabaseConfigured retorna false quando variáveis não estão definidas', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('helper isSupabaseConfigured retorna true quando URL e Anon Key são válidas', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('helper isSupabaseConfigured reconhece chaves com prefixo BOM UTF-8', () => {
    vi.stubEnv('\uFEFFVITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('\uFEFFVITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')
    expect(isSupabaseConfigured()).toBe(true)
  })

  it('lança erro ao utilizar useAuth fora de AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth deve ser utilizado dentro de um AuthProvider'
    )
    consoleError.mockRestore()
  })

  it('renderiza os filhos com estado inicial desautenticado quando não configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.isConfigured).toBe(false)
    expect(result.current.isGuestAcknowledged).toBe(false)
    expect(result.current.isAuthModalOpen).toBe(false)
  })

  it('controla abertura e fechamento do AuthModal via openAuthModal e closeAuthModal', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    expect(result.current.isAuthModalOpen).toBe(false)

    act(() => {
      result.current.openAuthModal()
    })
    expect(result.current.isAuthModalOpen).toBe(true)

    act(() => {
      result.current.closeAuthModal()
    })
    expect(result.current.isAuthModalOpen).toBe(false)
  })

  it('continueAsGuest define flag no localStorage e atualiza estado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    expect(result.current.isGuestAcknowledged).toBe(false)

    act(() => {
      result.current.continueAsGuest()
    })

    expect(result.current.isGuestAcknowledged).toBe(true)
    expect(localStorage.getItem('organy_guest_acknowledged')).toBe('true')
  })

  it('rejeita signUpWithPassword quando o serviço de autenticação não estiver configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signUpWithPassword(
        'Beatriz Costa',
        'beatriz@example.com',
        'minhasenha123'
      )
    })

    expect(res.error).not.toBeNull()
    expect(res.error?.message).toBe('Serviço de autenticação não configurado.')
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('organy_local_user')).toBeNull()
  })

  it('rejeita signInWithPassword quando o serviço de autenticação não estiver configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signInWithPassword('diego@example.com', 'senhaSegura123')
    })

    expect(res.error).not.toBeNull()
    expect(res.error?.message).toContain(
      'Serviço de autenticação não configurado. Para testar localmente, utilize a opção Continuar sem Conta.'
    )
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem('organy_local_user')).toBeNull()
  })

  it('executa signUpWithPassword com sucesso com Supabase configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    const signUpSpy = vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: {
        user: mockUser,
        session: mockSession,
      },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null; user?: User | null } = { error: null }
    await act(async () => {
      res = await result.current.signUpWithPassword(
        'Ana Silva',
        'ana.silva@example.com',
        'senha123456'
      )
    })

    expect(signUpSpy).toHaveBeenCalledWith({
      email: 'ana.silva@example.com',
      password: 'senha123456',
      options: {
        data: {
          full_name: 'Ana Silva',
          name: 'Ana Silva',
        },
      },
    })
    expect(res.error).toBeNull()
    expect(res.user).toEqual(mockUser)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.session).toEqual(mockSession)
  })

  it('rejeita signUpWithPassword quando o Supabase retorna erro', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered', name: 'AuthApiError', status: 400 },
    } as any)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signUpWithPassword(
        'Ana Silva',
        'ana.silva@example.com',
        'senha123456'
      )
    })

    expect(res.error).not.toBeNull()
    expect(res.error?.message).toBe(
      'Não foi possível criar a conta. Verifique os dados informados ou tente entrar caso já possua conta.'
    )
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('executa signUpWithPassword e tenta login imediato quando Supabase retorna user sem session', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
      data: {
        user: mockUser,
        session: null,
      },
      error: null,
    })

    const signInSpy = vi
      .spyOn(supabase.auth, 'signInWithPassword')
      .mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signUpWithPassword(
        'Ana Silva',
        'ana.silva@example.com',
        'senha123456'
      )
    })

    expect(signInSpy).toHaveBeenCalledWith({
      email: 'ana.silva@example.com',
      password: 'senha123456',
    })
    expect(res.error).toBeNull()
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.session).toEqual(mockSession)
  })

  it('executa signInWithPassword com credenciais válidas no Supabase configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    const signInSpy = vi
      .spyOn(supabase.auth, 'signInWithPassword')
      .mockResolvedValueOnce({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null; user?: User | null } = { error: null }
    await act(async () => {
      res = await result.current.signInWithPassword(
        'ana.silva@example.com',
        'senha123456'
      )
    })

    expect(signInSpy).toHaveBeenCalledWith({
      email: 'ana.silva@example.com',
      password: 'senha123456',
    })
    expect(res.error).toBeNull()
    expect(res.user).toEqual(mockUser)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.session).toEqual(mockSession)
    expect(result.current.isGuestAcknowledged).toBe(true)
  })

  it('rejeita estritamente signInWithPassword com credenciais inválidas no Supabase e não autentica', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: {
        user: null,
        session: null,
      },
      error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400 },
    } as any)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signInWithPassword(
        'ana.silva@example.com',
        'senha-errada'
      )
    })

    expect(res.error).not.toBeNull()
    expect(res.error?.message).toBe(
      'E-mail ou senha incorretos. Por favor, verifique suas credenciais.'
    )
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('rejeita estritamente signInWithPassword quando Supabase não retorna session ou user', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: {
        user: null,
        session: null,
      },
      error: null,
    } as any)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let res: { error: Error | null } = { error: null }
    await act(async () => {
      res = await result.current.signInWithPassword(
        'ana.silva@example.com',
        'senha123456'
      )
    })

    expect(res.error).not.toBeNull()
    expect(res.error?.message).toBe(
      'E-mail ou senha incorretos. Por favor, verifique suas credenciais.'
    )
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('executa signOut e limpa sessão e usuário no estado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
      error: null,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    const res = await act(async () => {
      return await result.current.signOut()
    })

    expect(signOutSpy).toHaveBeenCalledTimes(1)
    expect(res.error).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('signInWithGoogle retorna erro quando não configurado e executa OAuth quando configurado', async () => {
    // Não configurado
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result: unconfiguredResult } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    let errRes: { error: Error | null } = { error: null }
    await act(async () => {
      errRes = await unconfiguredResult.current.signInWithGoogle()
    })
    expect(errRes.error).not.toBeNull()
    expect(errRes.error?.message).toContain('Supabase não configurado')

    // Configurado
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    const oauthSpy = vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValueOnce({
      data: { provider: 'google', url: 'https://oauth.url' },
      error: null,
    })

    const { result: configuredResult } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(configuredResult.current.loading).toBe(false)
    })

    let okRes: { error: Error | null } = { error: null }
    await act(async () => {
      okRes = await configuredResult.current.signInWithGoogle()
    })
    expect(oauthSpy).toHaveBeenCalled()
    expect(okRes.error).toBeNull()
  })
  it('resetPasswordForEmail retorna erro quando não configurado e executa com redirect para /reset-password quando configurado', async () => {
    // Não configurado
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { result: unconfiguredResult } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    const unconfRes =
      await unconfiguredResult.current.resetPasswordForEmail('teste@exemplo.com')
    expect(unconfRes.error).not.toBeNull()
    expect(unconfRes.error?.message).toContain('não configurado')

    // Configurado
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any)

    const resetSpy = vi
      .spyOn(supabase.auth, 'resetPasswordForEmail')
      .mockResolvedValueOnce({
        data: {},
        error: null,
      } as any)

    const { result: configuredResult } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(configuredResult.current.loading).toBe(false)
    })

    const confRes = await configuredResult.current.resetPasswordForEmail(
      'aluno@faculdade.edu.br'
    )
    expect(resetSpy).toHaveBeenCalledWith('aluno@faculdade.edu.br', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    expect(confRes.error).toBeNull()
  })

  it('updateUserPassword executa updateUser com nova senha e limpa isPasswordRecovery', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-app.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-anon-key-secret')

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    let authChangeCallback: any
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((cb: any) => {
      authChangeCallback = cb
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      } as any
    })

    const updateSpy = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    } as any)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Dispara evento de PASSWORD_RECOVERY
    act(() => {
      authChangeCallback('PASSWORD_RECOVERY', mockSession)
    })

    expect(result.current.isPasswordRecovery).toBe(true)

    // Atualiza a senha
    let res: any
    await act(async () => {
      res = await result.current.updateUserPassword('NovaSenha#2026')
    })

    expect(updateSpy).toHaveBeenCalledWith({ password: 'NovaSenha#2026' })
    expect(res.error).toBeNull()
    expect(result.current.isPasswordRecovery).toBe(false)
  })
})
