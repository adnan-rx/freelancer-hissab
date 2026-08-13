/**
 * What `@CurrentUser()` resolves to — the row returned by `JwtStrategy.validate`.
 * Only the fields controllers actually read are declared.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin?: boolean | null;
}
