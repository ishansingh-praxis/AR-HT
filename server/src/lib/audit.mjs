/** Append-only record of admin/editor writes. Rows are only ever inserted. */
export async function audit(db, actorId, action, target, data) {
  await db.prepare('INSERT INTO audit_log(actor_id,action,target,at,data) VALUES(?,?,?,?,?)')
    .run(actorId ?? null, action, target ?? null, Date.now(), data === undefined ? null : JSON.stringify(data));
}
