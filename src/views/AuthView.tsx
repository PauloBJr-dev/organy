import React, { useState, useCallback } from 'react'
import {
  BookOpen,
  LayoutGrid,
  Zap,
  GraduationCap,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { GuestModeWarningModal } from '../components/auth/GuestModeWarningModal'
import { MigrationProgressModal } from '../components/auth/MigrationProgressModal'
import { migrationService } from '../services/migrationService'

export interface AuthViewProps {
  initialTab?: 'signup' | 'signin'
  showBackToBoard?: boolean
  onBackToBoard?: () => void
  onSuccess?: () => void
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialTab = 'signup',
  showBackToBoard = false,
  onBackToBoard,
  onSuccess,
}) => {
  const { user, signUpWithPassword, signInWithPassword, resetPasswordForEmail } =
    useAuth()
  const toast = useToast()

  // Abas e formulário
  const [tab, setTab] = useState<'signup' | 'signin'>(initialTab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fluxo Inline: Esqueceu a Senha
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  // Modais
  const [isGuestWarningOpen, setIsGuestWarningOpen] = useState(false)
  const [migratingUserId, setMigratingUserId] = useState<string | null>(null)
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)

  // Cálculo da Força da Senha
  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' }
    let score = 0
    if (pass.length >= 8) score++
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++
    if (/\d/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-rose-500' }
    if (score === 2) return { score: 2, label: 'Razoável', color: 'bg-amber-500' }
    if (score === 3) return { score: 3, label: 'Boa', color: 'bg-blue-500' }
    return { score: 4, label: 'Forte', color: 'bg-emerald-500' }
  }

  const passwordStrength = calculatePasswordStrength(password)

  // Tratar conclusão da autenticação (Cadastro ou Login)
  const handleAuthCompleted = useCallback(
    (createdUserId?: string) => {
      if (migrationService.hasGuestDataToMigrate() && createdUserId) {
        setMigratingUserId(createdUserId)
        setIsMigrationModalOpen(true)
      } else {
        onSuccess?.()
      }
    },
    [onSuccess]
  )

  // Submissão: Cadastro
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!name.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.')
      return
    }
    if (!email.trim()) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('A senha deve conter pelo menos 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const res = await signUpWithPassword(name.trim(), email.trim(), password)
      if (res.error) {
        setErrorMessage(res.error.message)
        toast.error(`Erro ao criar conta: ${res.error.message}`)
      } else {
        toast.success('Conta criada com sucesso! Bem-vindo(a) ao Organy.')
        // Recupera o ID do usuário criado se disponível na sessão
        const activeUserId = res.user?.id || user?.id
        const guestHasData = migrationService.hasGuestDataToMigrate()
        if (guestHasData) {
          // Dispara migração
          handleAuthCompleted(activeUserId)
        } else {
          onSuccess?.()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submissão: Login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail.')
      return
    }
    if (!password) {
      setErrorMessage('Por favor, informe sua senha.')
      return
    }

    setSubmitting(true)
    try {
      const res = await signInWithPassword(email.trim(), password)
      if (res.error) {
        setErrorMessage(res.error.message)
        toast.error(res.error.message)
      } else {
        toast.success('Login efetuado com sucesso!')
        const activeUserId = res.user?.id || user?.id
        const guestHasData = migrationService.hasGuestDataToMigrate()
        if (guestHasData) {
          handleAuthCompleted(activeUserId)
        } else {
          onSuccess?.()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submissão: Recuperação de Senha
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)

    if (!forgotEmail.trim()) {
      setForgotError('Por favor, informe o e-mail da sua conta.')
      return
    }

    setForgotLoading(true)
    try {
      const { error } = await resetPasswordForEmail(forgotEmail.trim())
      if (error) {
        setForgotError(error.message)
        toast.error(`Erro ao enviar link: ${error.message}`)
      } else {
        setForgotSuccess(true)
        toast.success('Link de recuperação enviado!')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  const handleTabSwitch = (newTab: 'signup' | 'signin') => {
    setTab(newTab)
    setErrorMessage(null)
    setIsForgotPassword(false)
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-12 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
      {/* PAINEL ESQUERDO: BRANDING ORGANY (Anexo 3) */}
      <div className="lg:col-span-5 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between shrink-0">
        {/* Glow decorativo de fundo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Topo: Badge Plataforma de Produtividade Acadêmica */}
        <div className="relative z-10 inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-blue-100 shadow-sm">
          <BookOpen className="w-3.5 h-3.5 text-blue-200 shrink-0" />
          <span>Plataforma de Produtividade Acadêmica</span>
        </div>

        {/* Centro: Logotipo, Tipografia Organy e Slogan */}
        <div className="relative z-10 my-8 lg:my-auto py-4 lg:py-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-xl flex items-center justify-center mb-5 text-white">
            <BookOpen className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3">
            Organy
          </h1>
          <p className="text-base sm:text-lg text-blue-100 font-medium max-w-sm leading-relaxed">
            Organize e Estude com clareza e foco.
          </p>
        </div>

        {/* Rodapé: 4 Pilares Acadêmicos (Oculto em mobile muito pequeno se necessário, visível em lg) */}
        <div className="relative z-10 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-blue-100 font-medium">
            <LayoutGrid className="w-4 h-4 text-blue-300 shrink-0" />
            <span>Gestão de blocos & rotina</span>
          </div>
          <div className="flex items-center gap-2.5 text-blue-100 font-medium">
            <Zap className="w-4 h-4 text-blue-300 shrink-0" />
            <span>Foco profundo sem distrações</span>
          </div>
          <div className="flex items-center gap-2.5 text-blue-100 font-medium">
            <GraduationCap className="w-4 h-4 text-blue-300 shrink-0" />
            <span>Ciclos de estudo acadêmico</span>
          </div>
          <div className="flex items-center gap-2.5 text-blue-100 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-300 shrink-0" />
            <span>Privacidade com Modo Local</span>
          </div>
        </div>
      </div>

      {/* PAINEL DIREITO: FORMULÁRIO & AÇÕES */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 bg-slate-50/60 dark:bg-slate-900/60 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          {/* Botão de Retorno ao Quadro (se visitante ativo veio do Kanban) */}
          {showBackToBoard && (
            <button
              type="button"
              onClick={onBackToBoard}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors font-medium self-start group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar ao quadro</span>
            </button>
          )}

          {/* FLUXO INLINE: RECUPERAR SENHA */}
          {isForgotPassword ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-200">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false)
                  setForgotSuccess(false)
                  setForgotError(null)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao login</span>
              </button>

              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                Recuperar Senha
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6">
                Digite seu e-mail para enviarmos o link seguro de redefinição de senha.
              </p>

              {forgotSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
                  <div className="flex items-start gap-2.5 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Link de recuperação enviado com sucesso!</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    Verifique sua caixa de entrada e pasta de spam. O e-mail contém um
                    link direto para você redefinir sua senha com segurança.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false)
                      setTab('signin')
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors mt-2"
                  >
                    Ir para o Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      E-mail acadêmico ou pessoal
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando link...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar Link de Recuperação</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* FLUXO PRINCIPAL: ENTRAR OU CRIAR CONTA */
            <div>
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  Bem-vindo ao Organy
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Acesse sua conta ou inicie sua rotina de estudos em instantes.
                </p>
              </div>

              {/* Segmented Switch de Abas */}
              <div
                role="tablist"
                className="grid grid-cols-2 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl mb-6"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'signup'}
                  onClick={() => handleTabSwitch('signup')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    tab === 'signup'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'signin'}
                  onClick={() => handleTabSwitch('signin')}
                  className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    tab === 'signin'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Entrar
                </button>
              </div>

              {/* Alerta de Erro */}
              {errorMessage && (
                <div className="p-3 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* FORMULÁRIO: CRIAR CONTA */}
              {tab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Nome Completo */}
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="signup-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como gostaria de ser chamado?"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* E-mail */}
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      E-mail acadêmico ou pessoal
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Senha */}
                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo de 8 caracteres"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Barra de Força da Senha */}
                    {password.length > 0 && (
                      <div className="mt-2">
                        <div className="grid grid-cols-4 gap-1.5 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                          <div
                            className={`h-full rounded-full transition-all ${
                              passwordStrength.score >= 1 ? passwordStrength.color : ''
                            }`}
                          />
                          <div
                            className={`h-full rounded-full transition-all ${
                              passwordStrength.score >= 2 ? passwordStrength.color : ''
                            }`}
                          />
                          <div
                            className={`h-full rounded-full transition-all ${
                              passwordStrength.score >= 3 ? passwordStrength.color : ''
                            }`}
                          />
                          <div
                            className={`h-full rounded-full transition-all ${
                              passwordStrength.score >= 4 ? passwordStrength.color : ''
                            }`}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>Força da senha</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {passwordStrength.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mensagem Tranquilizadora */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      ✨ Suas tarefas e anotações criadas neste navegador serão
                      sincronizadas com sua nova conta automaticamente.
                    </span>
                  </div>

                  {/* Botão de Envio */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando sua conta...</span>
                      </>
                    ) : (
                      <>
                        <span>Criar Conta e Começar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* FORMULÁRIO: ENTRAR */}
              {tab === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* E-mail */}
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      E-mail acadêmico ou pessoal
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Senha & Link Esqueceu sua senha? */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="signin-password"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email)
                          setIsForgotPassword(true)
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Botão Entrar */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar na Conta</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* SEÇÃO OU CONTINUE SEM CONTA */}
              <div className="relative my-7 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative inline-block px-3 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  ou continue sem conta
                </div>
              </div>

              {/* Botão Limpo de Convidado (Sem caixa amarela nem barra de rolagem) */}
              <button
                type="button"
                onClick={() => setIsGuestWarningOpen(true)}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition-all shadow-sm hover:border-slate-400 dark:hover:border-slate-600 flex items-center justify-center gap-2"
              >
                <span>Continuar sem Conta (Modo Convidado)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Aviso de Modo Convidado */}
      <GuestModeWarningModal
        isOpen={isGuestWarningOpen}
        onClose={() => setIsGuestWarningOpen(false)}
        onConfirm={() => {
          setIsGuestWarningOpen(false)
          onSuccess?.()
        }}
      />

      {/* Modal de Progresso de Migração */}
      <MigrationProgressModal
        isOpen={isMigrationModalOpen}
        userId={migratingUserId || ''}
        onComplete={() => {
          setIsMigrationModalOpen(false)
          onSuccess?.()
        }}
        onSkip={() => {
          setIsMigrationModalOpen(false)
          onSuccess?.()
        }}
      />
    </div>
  )
}
