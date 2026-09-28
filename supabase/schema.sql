-- ==============================================================================
-- DailyFlow Kanban - Supabase Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. Profiles Table (Sincronizado automaticamente com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    active_pomodoro_session JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração idempotente para colunas preferences e active_pomodoro_session em profiles
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'preferences'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'active_pomodoro_session'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN active_pomodoro_session JSONB DEFAULT NULL;
    END IF;
END $;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfis visíveis apenas para seus respectivos donos"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

    INSERT INTO public.kanban_columns (id, user_id, title, "order", color_theme)
    VALUES
        ('col-todo', NEW.id, 'A Fazer', 0, 'blue'),
        ('col-progress', NEW.id, 'Em Progresso', 1, 'amber'),
        ('col-review', NEW.id, 'Em Espera', 2, 'purple'),
        ('col-done', NEW.id, 'Concluído Hoje', 3, 'emerald')
    ON CONFLICT (id, user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Colunas do Kanban (kanban_columns)
CREATE TABLE IF NOT EXISTS public.kanban_columns (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    color_theme TEXT NOT NULL DEFAULT 'blue',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias colunas"
    ON public.kanban_columns FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_id ON public.kanban_columns(user_id);

-- 3. Tarefas do Kanban (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    subtasks JSONB NOT NULL DEFAULT '[]'::JSONB,
    completed_at TIMESTAMPTZ,
    pomodoro_minutes_spent INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id),
    CONSTRAINT fk_tasks_kanban_columns FOREIGN KEY (column_id, user_id) REFERENCES public.kanban_columns(id, user_id) ON DELETE CASCADE
);

-- Adicionar chave estrangeira para kanban_columns com deleção em cascata
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_kanban_columns'
    ) THEN
        ALTER TABLE public.tasks
            ADD CONSTRAINT fk_tasks_kanban_columns
            FOREIGN KEY (column_id, user_id)
            REFERENCES public.kanban_columns(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias tarefas"
    ON public.tasks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON public.tasks(user_id, column_id);

-- 4. Disciplinas do Espaço Acadêmico (subjects)
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'indigo',
    icon TEXT,
    code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias disciplinas"
    ON public.subjects FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON public.subjects(user_id);

-- 5. Anotações Acadêmicas (academic_notes)
CREATE TABLE IF NOT EXISTS public.academic_notes (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'to_review',
    tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    exam_date TEXT,
    review_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id),
    CONSTRAINT fk_notes_subjects FOREIGN KEY (subject_id, user_id) REFERENCES public.subjects(id, user_id) ON DELETE CASCADE
);

-- Adicionar chave estrangeira para subjects com deleção em cascata
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_notes_subjects'
    ) THEN
        ALTER TABLE public.academic_notes
            ADD CONSTRAINT fk_notes_subjects
            FOREIGN KEY (subject_id, user_id)
            REFERENCES public.subjects(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $;

ALTER TABLE public.academic_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias anotações"
    ON public.academic_notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_academic_notes_user_id ON public.academic_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_notes_subject_id ON public.academic_notes(user_id, subject_id);

-- 6. Histórico de Sessões Pomodoro (pomodoro_sessions)
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT,
    mode TEXT NOT NULL DEFAULT 'work',
    duration_minutes INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'pomodoro_sessions' 
          AND policyname = 'Usuários podem gerenciar suas próprias sessões pomodoro'
    ) THEN
        CREATE POLICY "Usuários podem gerenciar suas próprias sessões pomodoro"
            ON public.pomodoro_sessions FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON public.pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_completed_at ON public.pomodoro_sessions(user_id, completed_at);
