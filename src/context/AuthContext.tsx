/* eslint-disable react/only-export-components */
import React, { createContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { storageService } from '../services/storageService'
import { academicStorageService } from '../services/academicStorageService'

export interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  authModalInitialTab?: 'signin' | 'signup'
  isPasswordRecovery: boolean
  setIsPasswordRecovery: (value: boolean) => void
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  signUpWithPassword: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ error: Error | null; user?: User | null }>
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; user?: User | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updateUserPassword: (newPassword: string) => Promise<{ error: Error | null }>
  continueAsGuest: () => void
  isGuestAcknowledged: boolean
  isAuthModalOpen: boolean
  openAuthModal: (initialTab?: 'signin' | 'signup' | unknown) => void
  closeAuthModal: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const isConfigured = isSupabaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(() => isConfigured)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false)
  const [authModalInitialTab, setAuthModalInitialTab] = useState<
    'signin' | 'signup' | undefined
  >(undefined)

  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const pathname = window.location.pathname || ''
    return (
      hash.includes('type=recovery') ||
      (pathname === '/reset-password' &&
        (hash.includes('access_token') || search.includes('code')))
    )
  })

  const [isGuestAcknowledged, setIsGuestAcknowledged] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return (
      (localStorage.getItem('organy_guest_acknowledged') ??
        localStorage.getItem('dailyflow_guest_acknowledged') ??
        localStorage.getItem('organocat_guest_acknowledged')) === 'true'
    )
  })

  const openAuthModal = useCallback((initialTab?: 'signin' | 'signup' | unknown) => {
    if (initialTab === 'signin' || initialTab === 'signup') {
      setAuthModalInitialTab(initialTab)
    }
    setIsAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
  }, [])

  const continueAsGuest = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('organy_guest_acknowledged', 'true')
    }
    setIsGuestAcknowledged(true)
    setIsAuthModalOpen(false)
  }, [])

  const sanitizeUrlTokens = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || ''
      const search = window.location.search || ''
      const hasAccessToken = hash.includes('access_token')
      const hasCode = search.includes('code')
      if (hasAccessToken || hasCode) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [])

  useEffect(() => {
    sanitizeUrlTokens()
  }, [sanitizeUrlTokens])

  useEffect(() => {
    let isMounted = true

    if (!isConfigured) {
      return
    }

    // Obter sessão inicial do Supabase
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return
        if (error) {
          console.error('Erro ao recuperar sessão inicial:', error.message)
        }
        if (session) {
          setSession(session)
          setUser(session.user ?? null)
        }
        sanitizeUrlTokens()
        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Erro ao recuperar sessão Supabase:', err)
        sanitizeUrlTokens()
        setLoading(false)
      })

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }
      setSession(session)
      setUser(session?.user ?? null)
      sanitizeUrlTokens()
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [isConfigured, sanitizeUrlTokens])

  const signUpWithPassword = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<{ error: Error | null; user?: User | null }> => {
      if (!isConfigured) {
        return {
          error: new Error('Serviço de autenticação não configurado.'),
          user: null,
        }
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              name,
            },
          },
        })

        if (error) {
          return {
            error: new Error(
              'Não foi possível criar a conta. Verifique os dados informados ou tente entrar caso já possua conta.'
            ),
            user: null,
          }
        }

        if (data.session && data.user) {
          setSession(data.session)
          setUser(data.user)
          setIsGuestAcknowledged(true)
          if (typeof window !== 'undefined') {
            localStorage.setItem('organy_guest_acknowledged', 'true')
          }
          setIsAuthModalOpen(false)
          return { error: null, user: data.user }
        }

        // Se retornou usuário sem sessão imediata (caso raro)
        if (data.user) {
          const signInRes = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (!signInRes.error && signInRes.data?.session && signInRes.data?.user) {
            setSession(signInRes.data.session)
            setUser(signInRes.data.user)
            setIsGuestAcknowledged(true)
            if (typeof window !== 'undefined') {
              localStorage.setItem('organy_guest_acknowledged', 'true')
            }
            setIsAuthModalOpen(false)
            return { error: null, user: signInRes.data.user }
          }

          setIsAuthModalOpen(false)
          return { error: null, user: data.user }
        }

        return { error: null, user: data.user ?? null }
      } catch {
        return {
          error: new Error(
            'Não foi possível criar a conta. Verifique os dados informados ou tente entrar caso já possua conta.'
          ),
          user: null,
        }
      }
    },
    [isConfigured]
  )

  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ error: Error | null; user?: User | null }> => {
      if (!isConfigured) {
        return {
          error: new Error(
            'Serviço de autenticação não configurado. Para testar localmente, utilize a opção Continuar sem Conta.'
          ),
          user: null,
        }
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error || !data?.session || !data?.user) {
          return {
            error: new Error(
              'E-mail ou senha incorretos. Por favor, verifique suas credenciais.'
            ),
            user: null,
          }
        }

        setSession(data.session)
        setUser(data.user)
        setIsGuestAcknowledged(true)
        if (typeof window !== 'undefined') {
          localStorage.setItem('organy_guest_acknowledged', 'true')
        }
        setIsAuthModalOpen(false)
        return { error: null, user: data.user }
      } catch {
        return {
          error: new Error(
            'E-mail ou senha incorretos. Por favor, verifique suas credenciais.'
          ),
          user: null,
        }
      }
    },
    [isConfigured]
  )

  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return {
          error: new Error('Serviço de autenticação não configurado neste ambiente.'),
        }
      }

      try {
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/reset-password`
            : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        })

        if (error) {
          return { error: new Error(error.message) }
        }

        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) }
      }
    },
    [isConfigured]
  )

  const updateUserPassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return {
          error: new Error('Serviço de autenticação não configurado neste ambiente.'),
        }
      }

      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        })

        if (error) {
          return { error: new Error(error.message) }
        }

        setIsPasswordRecovery(false)
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) }
      }
    },
    [isConfigured]
  )

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!isConfigured) {
      const err = new Error(
        'Supabase não configurado. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
      )
      return { error: err }
    }

    try {
      const redirectTo =
        typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [isConfigured])

  const signOut = useCallback(async (): Promise<{ error: Error | null }> => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('organocat_guest_acknowledged')
      localStorage.removeItem('organocat_local_user')
      localStorage.removeItem('organocat_local_session')
    }

    setIsGuestAcknowledged(false)
    setIsPasswordRecovery(false)
    storageService.clear(null)
    academicStorageService.clear(null)

    let signOutError: Error | null = null
    if (isConfigured) {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          signOutError = new Error(error.message)
        }
      } catch (err) {
        signOutError = err instanceof Error ? err : new Error(String(err))
      }
    }

    setUser(null)
    setSession(null)
    openAuthModal('signin')

    return { error: signOutError }
  }, [isConfigured, openAuthModal])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      isConfigured,
      authModalInitialTab,
      isPasswordRecovery,
      setIsPasswordRecovery,
      signInWithGoogle,
      signOut,
      signUpWithPassword,
      signInWithPassword,
      resetPasswordForEmail,
      updateUserPassword,
      continueAsGuest,
      isGuestAcknowledged,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
    }),
    [
      user,
      session,
      loading,
      isConfigured,
      authModalInitialTab,
      isPasswordRecovery,
      setIsPasswordRecovery,
      signInWithGoogle,
      signOut,
      signUpWithPassword,
      signInWithPassword,
      resetPasswordForEmail,
      updateUserPassword,
      continueAsGuest,
      isGuestAcknowledged,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
