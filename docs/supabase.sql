-- Supabase schema for Medikit Chat

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer,
  gender text,
  username text not null,
  password_hash text not null,
  role text not null check (role in ('patient', 'doctor'))
);

alter table public.users add column if not exists username text;
alter table public.users add column if not exists password_hash text;
create unique index if not exists idx_users_username on public.users (username);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid references public.users(id),
  status text not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  submitted_to_doctor boolean not null default false
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  sender_id uuid references public.users(id),
  sender_role text not null check (sender_role in ('patient', 'doctor', 'ai')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_consultations_patient on public.consultations(patient_id);
create index if not exists idx_consultations_doctor on public.consultations(doctor_id);
create index if not exists idx_messages_consultation on public.messages(consultation_id);
