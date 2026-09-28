-- Trigger helpers are not API functions. Keep them callable by the trigger owner only.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
