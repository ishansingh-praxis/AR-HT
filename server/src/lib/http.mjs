/** An error with an HTTP status, rendered by middleware/errors.mjs. `extra` is merged into the JSON body. */
export const err = (status, message, extra) => Object.assign(new Error(message), { status, extra });

/** Product row -> product JSON. Model URLs are built here from the files base URL (rows only store a host-independent key). */
export const productFromRow = (row, filesBase) => {
  const p = JSON.parse(row.data);
  if (p.model3D?.key) p.model3D = { ...p.model3D, url: `${filesBase}/${p.model3D.key}` };
  return p;
};

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, emailVerified: !!(u.email_verified_at ?? u.emailVerified) });
