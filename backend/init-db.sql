-- PostgreSQL Database Schema for Personal Assistant
-- This file is executed by Docker when initializing the database
-- The database 'personal_assistant' is already created by Docker

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';
SET default_table_access_method = heap;

-- Create helper function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to check if an account can add more profiles
CREATE OR REPLACE FUNCTION can_add_profile(account_email_param VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    -- Get the current profile count and max allowed for this account
    SELECT 
        COUNT(u.user_id),
        a.max_profiles
    INTO current_count, max_allowed
    FROM accounts a
    LEFT JOIN users u ON u.account_email = a.email
    WHERE a.email = account_email_param
    GROUP BY a.max_profiles;
    
    -- If account doesn't exist, return false
    IF max_allowed IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if current count is less than max allowed
    RETURN current_count < max_allowed;
END;
$$ language 'plpgsql';

-- Function to get complete user profile information
CREATE OR REPLACE FUNCTION get_user_profile(user_id_param VARCHAR)
RETURNS TABLE (
    user_id VARCHAR,
    display_name VARCHAR,
    preferred_language VARCHAR,
    avatar_emoji VARCHAR,
    theme_preference VARCHAR,
    timezone VARCHAR,
    date_format VARCHAR,
    time_format VARCHAR,
    notifications_enabled BOOLEAN,
    voice_enabled BOOLEAN,
    auto_save BOOLEAN,
    privacy_level VARCHAR,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_active TIMESTAMP,
    is_active BOOLEAN,
    account_email VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.user_id,
        COALESCE(p.display_name, u.display_name) as display_name,
        COALESCE(p.preferred_language, u.preferred_language) as preferred_language,
        COALESCE(p.avatar_emoji, u.avatar_emoji) as avatar_emoji,
        COALESCE(p.theme_preference, u.theme_preference) as theme_preference,
        COALESCE(p.timezone, 'UTC'::VARCHAR) as timezone,
        COALESCE(p.date_format, 'MM/dd/yyyy'::VARCHAR) as date_format,
        COALESCE(p.time_format, '12h'::VARCHAR) as time_format,
        COALESCE(p.notifications_enabled, TRUE) as notifications_enabled,
        COALESCE(p.voice_enabled, TRUE) as voice_enabled,
        COALESCE(p.auto_save, TRUE) as auto_save,
        COALESCE(p.privacy_level, 'personal'::VARCHAR) as privacy_level,
        p.created_at,
        p.updated_at,
        u.last_active,
        u.is_active,
        u.account_email
    FROM users u
    LEFT JOIN user_profiles p ON u.user_id = p.user_id
    WHERE u.user_id = user_id_param;
END;
$$ language 'plpgsql';

-- Accounts table - stores family account metadata (auth handled by Supabase)
CREATE TABLE IF NOT EXISTS public.accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    max_profiles INTEGER DEFAULT 5,
    subscription_type VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

ALTER TABLE public.accounts OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.user_profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id character varying(50) UNIQUE NOT NULL,
    display_name character varying(100) NOT NULL,
    preferred_language character varying(10) DEFAULT 'en-US'::character varying NOT NULL,
    avatar_emoji character varying(10) DEFAULT '👤'::character varying,
    theme_preference character varying(20) DEFAULT 'default'::character varying,
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    date_format character varying(20) DEFAULT 'MM/dd/yyyy'::character varying,
    time_format character varying(10) DEFAULT '12h'::character varying,
    notifications_enabled boolean DEFAULT true,
    voice_enabled boolean DEFAULT true,
    auto_save boolean DEFAULT true,
    privacy_level character varying(20) DEFAULT 'personal'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- TOC entry 215 (class 1259 OID 33218)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) UNIQUE NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    display_name character varying(100),
    preferred_language character varying(10) DEFAULT 'en-US'::character varying,
    avatar_emoji character varying(10) DEFAULT '👤'::character varying,
    theme_preference character varying(20) DEFAULT 'default'::character varying,
    is_active boolean DEFAULT true,
    account_email character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 49593)
-- Name: account_with_profiles; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.account_with_profiles AS
 SELECT a.id,
    a.email,
    a.account_name,
    a.created_at,
    a.last_login,
    a.updated_at,
    a.max_profiles,
    a.subscription_type,
    count(u.user_id) AS profile_count,
    array_agg(json_build_object('user_id', u.user_id, 'display_name', up.display_name, 'avatar_emoji', up.avatar_emoji, 'last_active', u.last_active) ORDER BY u.last_active DESC NULLS LAST) FILTER (WHERE (u.user_id IS NOT NULL)) AS profiles
   FROM ((public.accounts a
     LEFT JOIN public.users u ON (((a.email)::text = (u.account_email)::text)))
     LEFT JOIN public.user_profiles up ON (((u.user_id)::text = (up.user_id)::text)))
  GROUP BY a.id, a.email, a.account_name, a.created_at, a.last_login, a.updated_at, a.max_profiles, a.subscription_type;


ALTER VIEW public.account_with_profiles OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 49546)
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO postgres;

--
-- TOC entry 3817 (class 0 OID 0)
-- Dependencies: 240
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- TOC entry 219 (class 1259 OID 33245)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.conversations (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) NOT NULL,
    message text NOT NULL,
    response text NOT NULL,
    actions jsonb,
    mode character varying(50),
    language character varying(10),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 33244)
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- TOC entry 3818 (class 0 OID 0)
-- Dependencies: 218
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- TOC entry 228 (class 1259 OID 41211)
-- Name: list_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.list_items (
    id SERIAL PRIMARY KEY,
    list_id integer NOT NULL,
    item_text text NOT NULL,
    is_completed boolean DEFAULT false,
    priority integer DEFAULT 0,
    due_date timestamp without time zone,
    notes text,
    quantity integer DEFAULT 1,
    order_index integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.list_items OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 41210)
-- Name: list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.list_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.list_items_id_seq OWNER TO postgres;

--
-- TOC entry 3819 (class 0 OID 0)
-- Dependencies: 227
-- Name: list_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.list_items_id_seq OWNED BY public.list_items.id;


--
-- TOC entry 234 (class 1259 OID 41271)
-- Name: memory_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.memory_categories (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) NOT NULL,
    category_name character varying(255) NOT NULL,
    category_type character varying(50) DEFAULT 'general'::character varying,
    description text,
    color character varying(7),
    icon character varying(10),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.memory_categories OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 41270)
-- Name: memory_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.memory_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.memory_categories_id_seq OWNER TO postgres;

--
-- TOC entry 3820 (class 0 OID 0)
-- Dependencies: 233
-- Name: memory_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.memory_categories_id_seq OWNED BY public.memory_categories.id;


--
-- TOC entry 239 (class 1259 OID 41332)
-- Name: memory_categories_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.memory_categories_summary AS
SELECT
    NULL::integer AS id,
    NULL::character varying(255) AS user_id,
    NULL::character varying(255) AS category_name,
    NULL::character varying(50) AS category_type,
    NULL::text AS description,
    NULL::character varying(7) AS color,
    NULL::character varying(10) AS icon,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at,
    NULL::bigint AS total_memories,
    NULL::bigint AS important_memories;


ALTER VIEW public.memory_categories_summary OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 41290)
-- Name: memory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.memory_items (
    id SERIAL PRIMARY KEY,
    category_id integer NOT NULL,
    memory_key character varying(255) NOT NULL,
    memory_value text NOT NULL,
    memory_type character varying(50) DEFAULT 'fact'::character varying,
    importance integer DEFAULT 0,
    tags text[],
    expires_at timestamp without time zone,
    is_private boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.memory_items OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 41289)
-- Name: memory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.memory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.memory_items_id_seq OWNER TO postgres;

--
-- TOC entry 3821 (class 0 OID 0)
-- Dependencies: 235
-- Name: memory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.memory_items_id_seq OWNED BY public.memory_items.id;


--
-- TOC entry 232 (class 1259 OID 41252)
-- Name: schedule_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.schedule_events (
    id SERIAL PRIMARY KEY,
    schedule_id integer NOT NULL,
    event_title character varying(255) NOT NULL,
    event_description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    location character varying(255),
    event_type character varying(50) DEFAULT 'appointment'::character varying,
    is_all_day boolean DEFAULT false,
    reminder_minutes integer,
    recurrence_rule text,
    is_cancelled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.schedule_events OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 41251)
-- Name: schedule_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.schedule_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedule_events_id_seq OWNER TO postgres;

--
-- TOC entry 3822 (class 0 OID 0)
-- Dependencies: 231
-- Name: schedule_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schedule_events_id_seq OWNED BY public.schedule_events.id;


--
-- TOC entry 224 (class 1259 OID 33318)
-- Name: user_complete_profile; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.user_complete_profile AS
 SELECT u.user_id,
    u.created_at AS user_created_at,
    u.last_active,
    COALESCE(p.display_name, u.user_id) AS display_name,
    COALESCE(p.preferred_language, 'en-US'::character varying) AS preferred_language,
    COALESCE(p.avatar_emoji, '👤'::character varying) AS avatar_emoji,
    COALESCE(p.theme_preference, 'default'::character varying) AS theme_preference,
    COALESCE(p.timezone, 'UTC'::character varying) AS timezone,
    COALESCE(p.date_format, 'MM/dd/yyyy'::character varying) AS date_format,
    COALESCE(p.time_format, '12h'::character varying) AS time_format,
    COALESCE(p.notifications_enabled, true) AS notifications_enabled,
    COALESCE(p.voice_enabled, true) AS voice_enabled,
    COALESCE(p.auto_save, true) AS auto_save,
    COALESCE(p.privacy_level, 'personal'::character varying) AS privacy_level,
    p.created_at AS profile_created_at,
    p.updated_at AS profile_updated_at
   FROM (public.users u
     LEFT JOIN public.user_profiles p ON (((u.user_id)::text = (p.user_id)::text)))
  WHERE (u.is_active = true);


ALTER VIEW public.user_complete_profile OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 33229)
-- Name: user_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.user_data (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) NOT NULL,
    data_type character varying(50) NOT NULL,
    data_key character varying(255) NOT NULL,
    data_value jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_data OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 33228)
-- Name: user_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.user_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_data_id_seq OWNER TO postgres;

--
-- TOC entry 3823 (class 0 OID 0)
-- Dependencies: 216
-- Name: user_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_data_id_seq OWNED BY public.user_data.id;


--
-- TOC entry 226 (class 1259 OID 41191)
-- Name: user_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.user_lists (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) NOT NULL,
    list_name character varying(255) NOT NULL,
    list_type character varying(50) DEFAULT 'general'::character varying,
    description text,
    color character varying(7),
    icon character varying(10),
    is_archived boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_lists OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 41190)
-- Name: user_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.user_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_lists_id_seq OWNER TO postgres;

--
-- TOC entry 3824 (class 0 OID 0)
-- Dependencies: 225
-- Name: user_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_lists_id_seq OWNED BY public.user_lists.id;


--
-- TOC entry 237 (class 1259 OID 41322)
-- Name: user_lists_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.user_lists_summary AS
SELECT
    NULL::integer AS id,
    NULL::character varying(255) AS user_id,
    NULL::character varying(255) AS list_name,
    NULL::character varying(50) AS list_type,
    NULL::text AS description,
    NULL::character varying(7) AS color,
    NULL::character varying(10) AS icon,
    NULL::boolean AS is_archived,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at,
    NULL::bigint AS total_items,
    NULL::bigint AS completed_items,
    NULL::bigint AS pending_items;


ALTER VIEW public.user_lists_summary OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 33267)
-- Name: user_profiles_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.user_profiles_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_profiles_profile_id_seq OWNER TO postgres;

--
-- TOC entry 3825 (class 0 OID 0)
-- Dependencies: 220
-- Name: user_profiles_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_profiles_profile_id_seq OWNED BY public.user_profiles.profile_id;


--
-- TOC entry 230 (class 1259 OID 41231)
-- Name: user_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS public.user_schedules (
    id SERIAL PRIMARY KEY,
    user_id character varying(255) NOT NULL,
    schedule_name character varying(255) NOT NULL,
    schedule_type character varying(50) DEFAULT 'personal'::character varying,
    description text,
    color character varying(7),
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_schedules OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 41230)
-- Name: user_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.user_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_schedules_id_seq OWNER TO postgres;

--
-- TOC entry 3826 (class 0 OID 0)
-- Dependencies: 229
-- Name: user_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_schedules_id_seq OWNED BY public.user_schedules.id;


--
-- TOC entry 238 (class 1259 OID 41327)
-- Name: user_schedules_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.user_schedules_summary AS
SELECT
    NULL::integer AS id,
    NULL::character varying(255) AS user_id,
    NULL::character varying(255) AS schedule_name,
    NULL::character varying(50) AS schedule_type,
    NULL::text AS description,
    NULL::character varying(7) AS color,
    NULL::character varying(50) AS timezone,
    NULL::boolean AS is_default,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at,
    NULL::bigint AS total_events,
    NULL::bigint AS upcoming_events,
    NULL::bigint AS past_events;


ALTER VIEW public.user_schedules_summary OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 33217)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 3828 (class 0 OID 0)
-- Dependencies: 214
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3573 (class 2604 OID 49550)
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- TOC entry 3519 (class 2604 OID 33248)
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- TOC entry 3544 (class 2604 OID 41214)
-- Name: list_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.list_items ALTER COLUMN id SET DEFAULT nextval('public.list_items_id_seq'::regclass);


--
-- TOC entry 3563 (class 2604 OID 41274)
-- Name: memory_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memory_categories ALTER COLUMN id SET DEFAULT nextval('public.memory_categories_id_seq'::regclass);


--
-- TOC entry 3567 (class 2604 OID 41293)
-- Name: memory_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.memory_items ALTER COLUMN id SET DEFAULT nextval('public.memory_items_id_seq'::regclass);


--
-- TOC entry 3557 (class 2604 OID 41255)
-- Name: schedule_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_events ALTER COLUMN id SET DEFAULT nextval('public.schedule_events_id_seq'::regclass);


--
-- TOC entry 3516 (class 2604 OID 33232)
-- Name: user_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_data ALTER COLUMN id SET DEFAULT nextval('public.user_data_id_seq'::regclass);


--
-- TOC entry 3539 (class 2604 OID 41194)
-- Name: user_lists id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_lists ALTER COLUMN id SET DEFAULT nextval('public.user_lists_id_seq'::regclass);


--
-- TOC entry 3521 (class 2604 OID 33271)
-- Name: user_profiles profile_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles ALTER COLUMN profile_id SET DEFAULT nextval('public.user_profiles_profile_id_seq'::regclass);


--
-- TOC entry 3551 (class 2604 OID 41234)
-- Name: user_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules ALTER COLUMN id SET DEFAULT nextval('public.user_schedules_id_seq'::regclass);


--
-- TOC entry 3509 (class 2604 OID 33221)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

DO $$ BEGIN
    ALTER TABLE ONLY public.memory_categories ADD CONSTRAINT memory_categories_user_id_category_name_key UNIQUE (user_id, category_name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3637 (class 2606 OID 41302)
-- Name: memory_items memory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.memory_items ADD CONSTRAINT memory_items_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3627 (class 2606 OID 41264)
-- Name: schedule_events schedule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.schedule_events ADD CONSTRAINT schedule_events_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3639 (class 2606 OID 41310)
-- Name: memory_items unique_memory_key_per_category; Type: CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.memory_items ADD CONSTRAINT unique_memory_key_per_category UNIQUE (category_id, memory_key);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3591 (class 2606 OID 33238)
-- Name: user_data user_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.user_data ADD CONSTRAINT user_data_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3611 (class 2606 OID 41202)
-- Name: user_lists user_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.user_lists ADD CONSTRAINT user_lists_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3613 (class 2606 OID 41204)
-- Name: user_lists user_lists_user_id_list_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_lists ADD CONSTRAINT user_lists_user_id_list_name_key UNIQUE (user_id, list_name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3599 (class 2606 OID 33285)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (profile_id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3601 (class 2606 OID 33287)
-- Name: user_profiles user_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3620 (class 2606 OID 41243)
-- Name: user_schedules user_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.user_schedules ADD CONSTRAINT user_schedules_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3622 (class 2606 OID 41245)
-- Name: user_schedules user_schedules_user_id_schedule_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_schedules ADD CONSTRAINT user_schedules_user_id_schedule_name_key UNIQUE (user_id, schedule_name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3585 (class 2606 OID 33225)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3587 (class 2606 OID 33227)
-- Name: users users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- SKIPPED: Already created inline in CREATE TABLE statement
-- DO $$ BEGIN
--     ALTER TABLE ONLY public.users ADD CONSTRAINT users_user_id_key UNIQUE (user_id);
-- EXCEPTION
--     WHEN duplicate_object THEN NULL;
-- END $$;


--
-- TOC entry 3594 (class 1259 OID 33262)
-- Name: idx_conversations_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_conversations_mode ON public.conversations USING btree (mode);


--
-- TOC entry 3595 (class 1259 OID 33261)
-- Name: idx_conversations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations USING btree (user_id);


--
-- TOC entry 3596 (class 1259 OID 33317)
-- Name: idx_conversations_user_id_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_conversations_user_id_created ON public.conversations USING btree (user_id, created_at DESC);


--
-- TOC entry 3614 (class 1259 OID 41314)
-- Name: idx_list_items_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_list_items_completed ON public.list_items USING btree (is_completed);


--
-- TOC entry 3615 (class 1259 OID 41313)
-- Name: idx_list_items_list_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items USING btree (list_id);


--
-- TOC entry 3628 (class 1259 OID 41319)
-- Name: idx_memory_categories_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_memory_categories_user_id ON public.memory_categories USING btree (user_id);


--
-- TOC entry 3633 (class 1259 OID 41320)
-- Name: idx_memory_items_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_memory_items_category_id ON public.memory_items USING btree (category_id);


--
-- TOC entry 3634 (class 1259 OID 41308)
-- Name: idx_memory_items_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_memory_items_key ON public.memory_items USING btree (memory_key);


--
-- TOC entry 3635 (class 1259 OID 41321)
-- Name: idx_memory_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_memory_items_type ON public.memory_items USING btree (memory_type);


--
-- TOC entry 3623 (class 1259 OID 41316)
-- Name: idx_schedule_events_schedule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_schedule_events_schedule_id ON public.schedule_events USING btree (schedule_id);


--
-- TOC entry 3624 (class 1259 OID 41317)
-- Name: idx_schedule_events_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_schedule_events_start_time ON public.schedule_events USING btree (start_time);


--
-- TOC entry 3625 (class 1259 OID 41318)
-- Name: idx_schedule_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_schedule_events_type ON public.schedule_events USING btree (event_type);


--
-- TOC entry 3588 (class 1259 OID 33316)
-- Name: idx_user_data_user_id_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_data_user_id_type ON public.user_data USING btree (user_id, data_type);


--
-- TOC entry 3589 (class 1259 OID 33260)
-- Name: idx_user_data_user_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_data_user_type ON public.user_data USING btree (user_id, data_type);


--
-- TOC entry 3608 (class 1259 OID 41312)
-- Name: idx_user_lists_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_lists_type ON public.user_lists USING btree (list_type);


--
-- TOC entry 3609 (class 1259 OID 41311)
-- Name: idx_user_lists_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON public.user_lists USING btree (user_id);


--
-- TOC entry 3597 (class 1259 OID 33313)
-- Name: idx_user_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);


--
-- TOC entry 3618 (class 1259 OID 41315)
-- Name: idx_user_schedules_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_user_schedules_user_id ON public.user_schedules USING btree (user_id);


--
-- TOC entry 3583 (class 1259 OID 49587)
-- Name: idx_users_account_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX IF NOT EXISTS idx_users_account_email ON public.users USING btree (account_email);


--
-- TOC entry 3806 (class 2618 OID 41325)
-- Name: user_lists_summary _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.user_lists_summary AS
 SELECT ul.id,
    ul.user_id,
    ul.list_name,
    ul.list_type,
    ul.description,
    ul.color,
    ul.icon,
    ul.is_archived,
    ul.created_at,
    ul.updated_at,
    count(li.id) AS total_items,
    count(
        CASE
            WHEN (li.is_completed = true) THEN 1
            ELSE NULL::integer
        END) AS completed_items,
    count(
        CASE
            WHEN (li.is_completed = false) THEN 1
            ELSE NULL::integer
        END) AS pending_items
   FROM (public.user_lists ul
     LEFT JOIN public.list_items li ON ((ul.id = li.list_id)))
  GROUP BY ul.id, ul.user_id, ul.list_name, ul.list_type, ul.description, ul.color, ul.icon, ul.is_archived, ul.created_at, ul.updated_at;


--
-- TOC entry 3807 (class 2618 OID 41330)
-- Name: user_schedules_summary _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.user_schedules_summary AS
 SELECT us.id,
    us.user_id,
    us.schedule_name,
    us.schedule_type,
    us.description,
    us.color,
    us.timezone,
    us.is_default,
    us.created_at,
    us.updated_at,
    count(se.id) AS total_events,
    count(
        CASE
            WHEN (se.start_time > now()) THEN 1
            ELSE NULL::integer
        END) AS upcoming_events,
    count(
        CASE
            WHEN (se.start_time < now()) THEN 1
            ELSE NULL::integer
        END) AS past_events
   FROM (public.user_schedules us
     LEFT JOIN public.schedule_events se ON (((us.id = se.schedule_id) AND (se.is_cancelled = false))))
  GROUP BY us.id, us.user_id, us.schedule_name, us.schedule_type, us.description, us.color, us.timezone, us.is_default, us.created_at, us.updated_at;


--
-- TOC entry 3808 (class 2618 OID 41335)
-- Name: memory_categories_summary _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.memory_categories_summary AS
 SELECT mc.id,
    mc.user_id,
    mc.category_name,
    mc.category_type,
    mc.description,
    mc.color,
    mc.icon,
    mc.created_at,
    mc.updated_at,
    count(mi.id) AS total_memories,
    count(
        CASE
            WHEN (mi.importance = 1) THEN 1
            ELSE NULL::integer
        END) AS important_memories
   FROM (public.memory_categories mc
     LEFT JOIN public.memory_items mi ON ((mc.id = mi.category_id)))
  WHERE ((mi.expires_at IS NULL) OR (mi.expires_at > now()))
  GROUP BY mc.id, mc.user_id, mc.category_name, mc.category_type, mc.description, mc.color, mc.icon, mc.created_at, mc.updated_at;


--
-- TOC entry 3662 (class 2620 OID 49591)
-- Name: accounts trigger_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();


--
-- TOC entry 3661 (class 2620 OID 33324)
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3651 (class 2606 OID 33254)
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.conversations ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3649 (class 2606 OID 49564)
-- Name: users fk_users_account; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.users ADD CONSTRAINT fk_users_account FOREIGN KEY (account_email) REFERENCES public.accounts(email) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3655 (class 2606 OID 41225)
-- Name: list_items list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.list_items ADD CONSTRAINT list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_lists(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3658 (class 2606 OID 41284)
-- Name: memory_categories memory_categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.memory_categories ADD CONSTRAINT memory_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3659 (class 2606 OID 41303)
-- Name: memory_items memory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.memory_items ADD CONSTRAINT memory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.memory_categories(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3657 (class 2606 OID 41265)
-- Name: schedule_events schedule_events_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.schedule_events ADD CONSTRAINT schedule_events_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.user_schedules(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3650 (class 2606 OID 33239)
-- Name: user_data user_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_data ADD CONSTRAINT user_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3654 (class 2606 OID 41205)
-- Name: user_lists user_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_lists ADD CONSTRAINT user_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3652 (class 2606 OID 33288)
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


--
-- TOC entry 3656 (class 2606 OID 41246)
-- Name: user_schedules user_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

DO $$ BEGIN
    ALTER TABLE ONLY public.user_schedules ADD CONSTRAINT user_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- Completed on 2025-10-10 23:50:54 PDT

--
-- PostgreSQL database dump complete
--