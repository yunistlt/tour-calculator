-- Расширение для хеша паролей
create extension if not exists pgcrypto;

-- Пользователи (организаторы)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null, -- будет храниться как хеш через триггер
  created_at timestamptz default now()
);

-- Хэшируем пароль на вставке
create or replace function hash_password() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.password := crypt(new.password, gen_salt('bf'));
  elsif tg_op = 'UPDATE' and new.password <> old.password then
    new.password := crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_hash_password on users;
create trigger users_hash_password before insert or update on users
for each row execute procedure hash_password();

-- Функция логина
create or replace function login_user(p_username text, p_password text)
returns users as $$
declare u users;
begin
  select * into u from users where username = p_username;
  if not found then
    return null;
  end if;
  if u.password = crypt(p_password, u.password) then
    return u;
  else
    return null;
  end if;
end;
$$ language plpgsql security definer;

-- Справочник услуг
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null,
  type text not null check (type in ('PER_PERSON','PER_GROUP')),
  price numeric(12,2) not null default 0,
  created_at timestamptz default now()
);
