export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: "admin" | "waiter" | "chef" | "consumer";
  enabledModules?: Array<
    | "kitchen"
    | "course_rounds"
    | "inventory"
    | "customers"
    | "analytics"
    | "printing"
    | "public_menu"
    | "public_takeaway"
    | "consumer_accounts"
    | "loyalty_points"
    | "self_order_qr"
    | "reservations"
    | "delivery"
    | "purchasing_suppliers"
    | "staff_shifts_timeclock"
    | "fiscal_exports"
    | "simple_catalog"
    | "public_group_order"
  >;
  scope?: string;
  permissions?: string[];
  sessionId?: string;
  tokenType?: "access" | "consumer_access";
  iat?: number;
  exp?: number;
}
