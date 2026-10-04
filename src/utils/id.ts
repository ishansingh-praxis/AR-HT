/** Short unique id for things created on the phone (designs). Not a secret: it only has to be unique and URL-safe. */
export const newId = (): string => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
