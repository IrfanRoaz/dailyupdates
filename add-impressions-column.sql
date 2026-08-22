alter table public.domains
  add column if not exists impressions_last_week integer not null default 0;

update public.domains set impressions_last_week = 80    where name = 'betprowebapp.com';
update public.domains set impressions_last_week = 155   where name = 'betproaccount.net';
update public.domains set impressions_last_week = 666   where name = 'betproapp.com';
update public.domains set impressions_last_week = 18000 where name = 'betprodealer.co';
update public.domains set impressions_last_week = 1200  where name = 'betpronumber.com';
update public.domains set impressions_last_week = 30    where name = 'betproo.co';
update public.domains set impressions_last_week = 375   where name = 'betprowallets.com';
update public.domains set impressions_last_week = 721   where name = 'bpexchapp.live';
update public.domains set impressions_last_week = 4400  where name = 'bpexchlive.com';
update public.domains set impressions_last_week = 74    where name = 'bpexchs.live';
update public.domains set impressions_last_week = 29    where name = 'dubaibetproexch.com';

select name, impressions_last_week from public.domains order by sort_order;
