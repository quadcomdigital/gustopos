export interface SuperadminJwtPayload {
  sub: string;
  username: string;
  scope: "superadmin";
  sessionId: string;
  tokenType?: "access";
  iat?: number;
  exp?: number;
}
