import { describe, expect, it } from "vitest";
// @ts-expect-error — modulo .mjs sin tipos
import { checkMigration } from "./check-migrations.mjs";

const check = checkMigration as (sql: string, name?: string) => string[];

describe("check-migrations (R26, R27, R30)", () => {
  it("rechaza auth.uid() pelado en una policy", () => {
    const sql = `create policy x on public.t for select to authenticated using (student_id = auth.uid());`;
    expect(check(sql)).toHaveLength(1);
  });

  it("acepta (select auth.uid())", () => {
    const sql = `create policy x on public.t for select to authenticated using (student_id = (select auth.uid()));`;
    expect(check(sql)).toEqual([]);
  });

  it("ignora auth.uid() dentro de comentarios", () => {
    const sql = `-- antes usaba auth.uid() pelado\n/* auth.uid() */ select 1;`;
    expect(check(sql)).toEqual([]);
  });

  it("exige revoke a anon en funciones nuevas", () => {
    const sql = `create or replace function public.mi_rpc() returns int language sql as $$ select 1 $$;`;
    expect(check(sql)).toHaveLength(1);
  });

  it("acepta una funcion con revoke a anon", () => {
    const sql = `create function public.mi_rpc() returns int language sql as $$ select 1 $$;
revoke execute on function public.mi_rpc() from public, anon, authenticated;
grant execute on function public.mi_rpc() to authenticated;`;
    expect(check(sql)).toEqual([]);
  });

  it("exige indice en una FK nueva", () => {
    const sql = `alter table public.a add constraint fk foreign key (b_id) references public.b(id);`;
    expect(check(sql)).toHaveLength(1);
    expect(
      check(`${sql}\ncreate index idx_a_b on public.a using btree (b_id);`),
    ).toEqual([]);
  });
});
