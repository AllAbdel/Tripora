-- Le créateur lit son voyage sans dépendre du déclencheur d'appartenance.
--
-- `.insert().select('id')` produit un `INSERT ... RETURNING`, et PostgreSQL
-- applique la politique SELECT à la ligne renvoyée. Or le déclencheur qui
-- inscrit le créateur dans trip_members est `AFTER INSERT` : au moment où
-- RETURNING est projeté, l'appartenance n'existe pas encore, `is_trip_member`
-- répond faux, et la lecture est refusée.
--
-- Conséquence : toute création de voyage échouait, systématiquement, sur un
-- 42501 que rien ne rattachait à sa cause — l'insertion elle-même était
-- pourtant autorisée, seule la relecture ne l'était pas.
--
-- Le créateur est membre de son voyage par construction. On l'écrit dans la
-- politique plutôt que de le déduire d'une ligne écrite après coup : la règle
-- devient vraie pendant l'insertion, et pas seulement après.
drop policy "voyage : lecture par les membres" on public.trips;

create policy "voyage : lecture par le créateur et les membres"
  on public.trips for select to authenticated
  using (deleted_at is null and (owner_id = auth.uid() or public.is_trip_member(id)));
