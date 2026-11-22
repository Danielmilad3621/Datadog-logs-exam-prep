-- Schema-only recovery of migration 20261107221505 from the running project.
-- Contains no user rows or progress imports; existing production history skips this file.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."can_study"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='danielmilad3621@gmail.com' AND u.email_confirmed_at IS NOT NULL AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google'));
$$;


ALTER FUNCTION "private"."can_study"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."create_study_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF lower(NEW.email)='danielmilad3621@gmail.com' THEN
  INSERT INTO public.profiles(id,display_name,avatar_url) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),coalesce(NEW.raw_user_meta_data->>'avatar_url','')) ON CONFLICT DO NOTHING;
  INSERT INTO public.study_progress(user_id,progress,revision) SELECT NEW.id,progress,1 FROM private.progress_imports WHERE email=lower(NEW.email) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;


ALTER FUNCTION "private"."create_study_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."save_study_progress"("payload" "jsonb", "expected_revision" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE next_revision integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_study() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF jsonb_typeof(payload->'cards') IS DISTINCT FROM 'object' OR jsonb_typeof(payload->'answers') IS DISTINCT FROM 'object' OR jsonb_typeof(payload->'history') IS DISTINCT FROM 'array' OR octet_length(payload::text)>2000000 THEN RAISE EXCEPTION 'Invalid progress'; END IF;
 IF expected_revision=0 THEN
  INSERT INTO public.study_progress(user_id,progress,revision) VALUES(auth.uid(),payload,1) ON CONFLICT DO NOTHING RETURNING revision INTO next_revision;
 ELSE
  UPDATE public.study_progress SET progress=payload,revision=revision+1,updated_at=now() WHERE user_id=auth.uid() AND revision=expected_revision RETURNING revision INTO next_revision;
 END IF;
 IF next_revision IS NULL THEN RAISE EXCEPTION 'SYNC_CONFLICT'; END IF;
 RETURN next_revision;
END; $$;


ALTER FUNCTION "private"."save_study_progress"("payload" "jsonb", "expected_revision" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_study_progress"("payload" "jsonb", "expected_revision" integer) RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$ SELECT private.save_study_progress(payload,expected_revision); $$;


ALTER FUNCTION "public"."save_study_progress"("payload" "jsonb", "expected_revision" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "private"."progress_imports" (
    "email" "text" NOT NULL,
    "progress" "jsonb" NOT NULL
);


ALTER TABLE "private"."progress_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_progress" (
    "user_id" "uuid" NOT NULL,
    "progress" "jsonb" DEFAULT '{"cards": {}, "answers": {}, "history": []}'::"jsonb" NOT NULL,
    "revision" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."study_progress" OWNER TO "postgres";


ALTER TABLE ONLY "private"."progress_imports"
    ADD CONSTRAINT "progress_imports_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_progress"
    ADD CONSTRAINT "study_progress_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_progress"
    ADD CONSTRAINT "study_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "own_profile_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."can_study"() AS "can_study")));



CREATE POLICY "own_profile_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."can_study"() AS "can_study"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."can_study"() AS "can_study")));



CREATE POLICY "own_progress_read" ON "public"."study_progress" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."can_study"() AS "can_study")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_progress" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."can_study"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_study"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."create_study_profile"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."save_study_progress"("payload" "jsonb", "expected_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."save_study_progress"("payload" "jsonb", "expected_revision" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."save_study_progress"("payload" "jsonb", "expected_revision" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_study_progress"("payload" "jsonb", "expected_revision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_study_progress"("payload" "jsonb", "expected_revision" integer) TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."study_progress" TO "service_role";
GRANT SELECT ON TABLE "public"."study_progress" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








-- The auth.users trigger is outside the schema-only public/private dump.
CREATE TRIGGER create_study_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.create_study_profile();
