alter table public.products
    add column if not exists priority integer not null default 100,
    add column if not exists show_on_home boolean not null default false,
    add column if not exists show_on_shop boolean not null default true,
    add column if not exists avg_rating numeric(3,2) not null default 0,
    add column if not exists review_count integer not null default 0;

update public.products
set priority = coalesce(priority, 100),
    show_on_home = coalesce(show_on_home, false),
    show_on_shop = coalesce(show_on_shop, true),
    avg_rating = coalesce(avg_rating, 0),
    review_count = coalesce(review_count, 0);

create or replace function public.refresh_product_rating_summary(target_product_id bigint)
returns void
language plpgsql
as $$
declare
    rating_avg numeric(3,2) := 0;
    rating_total integer := 0;
    has_rating boolean;
    has_avg_rating boolean;
    has_review_count boolean;
    has_rating_count boolean;
    has_updated_at boolean;
    update_sql text := 'update public.products set ';
begin
    select coalesce(round(avg(rating)::numeric, 2), 0), count(*)
    into rating_avg, rating_total
    from public.reviews
    where product_id = target_product_id;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'rating'
    ) into has_rating;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'avg_rating'
    ) into has_avg_rating;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'review_count'
    ) into has_review_count;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'rating_count'
    ) into has_rating_count;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'products' and column_name = 'updated_at'
    ) into has_updated_at;

    if has_rating then
        update_sql := update_sql || format('rating = %L, ', rating_avg);
    end if;

    if has_avg_rating then
        update_sql := update_sql || format('avg_rating = %L, ', rating_avg);
    end if;

    if has_review_count then
        update_sql := update_sql || format('review_count = %s, ', rating_total);
    end if;

    if has_rating_count then
        update_sql := update_sql || format('rating_count = %s, ', rating_total);
    end if;

    if has_updated_at then
        update_sql := update_sql || 'updated_at = now(), ';
    end if;

    update_sql := regexp_replace(update_sql, ', $', '');
    update_sql := update_sql || ' where id = $1';

    execute update_sql using target_product_id;
end;
$$;

create or replace function public.sync_product_rating_summary_trigger()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' then
        perform public.refresh_product_rating_summary(old.product_id);
        return old;
    end if;

    perform public.refresh_product_rating_summary(new.product_id);

    if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
        perform public.refresh_product_rating_summary(old.product_id);
    end if;

    return new;
end;
$$;

drop trigger if exists trg_sync_product_rating_summary on public.reviews;

create trigger trg_sync_product_rating_summary
after insert or update or delete on public.reviews
for each row
execute function public.sync_product_rating_summary_trigger();

do $$
declare
    product_row record;
begin
    for product_row in select id from public.products loop
        perform public.refresh_product_rating_summary(product_row.id);
    end loop;
end $$;
