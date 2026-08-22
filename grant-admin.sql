insert into public.admins (user_id)
select id from auth.users where email = 'admin@statusdashboard.local'
on conflict do nothing;

select u.email from public.admins a join auth.users u on u.id = a.user_id;
