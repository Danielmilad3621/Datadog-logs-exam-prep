"""Validate the question-bank migration in an isolated database in our test container."""
import json
import concurrent.futures
import subprocess
import uuid
from pathlib import Path

container = "log-lab-bank-test"
database = "bank_test_" + uuid.uuid4().hex[:12]

def sql(statement, db=database):
    result = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db],
        input=statement, text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

sql("create database " + database, "postgres")
try:
    sql("""
      do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on sequences to anon, authenticated;
      alter default privileges in schema public grant all on functions to anon, authenticated;
      create schema private;
      grant usage on schema private to authenticated;
      create function private.can_study() returns boolean language sql stable as $$
        select coalesce(current_setting('test.allow_study', true) = 'true', false);
      $$;
    """)
    sql(Path("supabase/migrations/20261122000100_question_bank.sql").read_text())
    migrated = json.loads(sql("""
      select json_agg(json_build_object(
        'id',q.id,'prompt',q.prompt,'options',q.options,'answers',q.answers,'type',q.type,
        'domain',c.domain,'topic',c.topic,'topicCode',c.code,'sourcePage',q.source_page,'flags',q.flags
      ) order by q.id) from public.questions q join public.question_categories c on c.code=q.category_code;
    """))
    original = json.loads(Path("src/data/questions.json").read_text())
    assert migrated == original, "Original question IDs/content/answers changed"
    sql("""
      do $$ begin
        assert (select count(*) from public.questions) = 210;
        assert (select count(*) from public.question_categories) = 18;
        assert not has_table_privilege('anon','public.questions','select');
        assert not has_table_privilege('authenticated','public.questions','delete');
        assert not has_sequence_privilege('anon','public.questions_id_seq','usage');
        assert not has_sequence_privilege('authenticated','public.questions_id_seq','update');
        assert not has_function_privilege('anon','public.set_question_set_difficulty(integer,text)','execute');
        assert not has_function_privilege('anon','public.validate_question()','execute');
        assert not has_table_privilege('authenticated','public.question_categories','delete');
      end $$;
      set role authenticated;
      select set_config('test.allow_study','false',false);
      do $$ begin
        assert (select count(*) from public.questions) = 0;
        begin
          insert into public.question_categories values ('ZZ1','Forbidden','Forbidden');
          raise exception 'Unauthorized insert was accepted';
        exception when insufficient_privilege then null;
        end;
      end $$;
      select set_config('test.allow_study','true',false);
      do $$ begin
        assert (select count(*) from public.questions) = 210;
      end $$;
      insert into public.questions(category_code,prompt,options,answers,type)
        values('LA2','Local validation question','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['A'],'single');
      do $$ begin
        assert (select id from public.questions where prompt='Local validation question') = 211;
        begin
          insert into public.questions(category_code,prompt,options,answers,type)
            values('LA2',' LOCAL   validation question ','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['A'],'single');
          raise exception 'Duplicate prompt was accepted';
        exception when unique_violation then null;
        end;
        begin
          insert into public.questions(category_code,prompt,options,answers,type)
            values('LA2','Bad key','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['Z'],'single');
          raise exception 'Bad answer was accepted';
        exception when raise_exception then
          if sqlerrm = 'Bad answer was accepted' then raise; end if;
        end;
        begin
          insert into public.questions(category_code,prompt,options,answers,type)
            values('LA2','Atomic first','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['A'],'single'),
                  ('LA2','Atomic second','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['Z'],'single');
        exception when raise_exception then null;
        end;
        assert not exists(select from public.questions where prompt='Atomic first'), 'Partial import was saved';
        begin
          update public.questions set status='draft' where id=1;
          raise exception 'Published question reverted to draft';
        exception when raise_exception then
          if sqlerrm = 'Published question reverted to draft' then raise; end if;
        end;
        begin
          update public.questions set id=999 where id=1;
          raise exception 'Question ID was changed';
        exception when insufficient_privilege then null;
        when sqlstate '428C9' then null;
        when raise_exception then if sqlerrm='Question ID was changed' then raise; end if;
        end;
      end $$;
      update public.questions set explanation='Reviewed locally' where id=211 and revision=1;
      do $$ begin assert (select revision from public.questions where id=211)=2; end $$;
      select public.set_question_set_difficulty(1,'hard');
      do $$ begin
        assert (select count(*) from public.questions where set_id=1 and difficulty='hard')=210;
        assert (select default_difficulty from public.question_sets where id=1)='hard';
      end $$;
    """)
    def concurrent_insert(_):
        try:
            sql("""set role authenticated;
              select set_config('test.allow_study','true',false);
              begin;
              insert into public.questions(category_code,prompt,options,answers,type)
              values('LA2','Concurrent duplicate','[{"key":"A","text":"One"},{"key":"B","text":"Two"}]',array['A'],'single');
              select pg_sleep(0.2);
              commit;""")
            return True
        except RuntimeError as error:
            assert "already exists" in str(error)
            return False
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(concurrent_insert, range(2)))
    assert sorted(results) == [False, True], "Concurrent duplicate insert was not blocked"
    assert sql("select count(*) from public.questions where prompt='Concurrent duplicate'") == "1"
    print("PASS: 210 original questions preserved exactly; IDs, validation, atomic imports, revisions, owner-only RLS and set difficulty verified.")
finally:
    sql("drop database " + database, "postgres")
