-- Local development seed (runs on `supabase db reset`). Not used in production.
-- The real catalogue is imported from Wikidata in Phase 2.
insert into public.movies (title, release_year, aliases, wikidata_id) values
  ('Baahubali: The Beginning', 2015, '{}', null),
  ('Baahubali 2: The Conclusion', 2017, '{}', null),
  ('Ala Vaikunthapurramuloo', 2020, '{AVPL}', null),
  ('Jersey', 2019, '{}', null),
  ('RRR', 2022, '{}', null),
  ('Hi Nanna', 2023, '{}', null),
  ('Magadheera', 2009, '{}', null),
  ('Arya', 2004, '{}', null),
  ('Arya 2', 2009, '{}', null),
  ('Pokiri', 2006, '{}', null),
  ('Eega', 2012, '{}', null),
  ('Geetha Govindam', 2018, '{}', null),
  ('Mahanati', 2018, '{}', null),
  ('Rangasthalam', 2018, '{}', null),
  ('Sita Ramam', 2022, '{}', null),
  ('Pushpa: The Rise', 2021, '{}', null),
  ('Nuvvostanante Nenoddantana', 2005, '{NVNA}', null),
  ('Bommarillu', 2006, '{}', null),
  ('Athadu', 2005, '{}', null),
  ('Khaleja', 2010, '{}', null);
