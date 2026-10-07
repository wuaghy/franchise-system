import type { User } from "./auth.ts";

export type Screen =
  | "landing"
  | "customer"
  | "stores"
  | "inventory"
  | "transfers"
  | "bom-studio"
  | "pos"
  | "kds"
  | "analytics";

export type Portal = "landing" | "customer" | "staff" | "admin";

/**
 * Screen to Portal mapping
 */
export function getPortalForScreen(s: Screen): Portal {
  if (s === "landing") return "landing";
  if (s === "customer") return "customer";
  if (s === "pos" || s === "kds" || s === "transfers") return "staff";
  return "admin"; // stores, inventory, bom-studio, analytics
}

/**
 * Check if a user (or guest) is permitted to access a specific screen.
 * If user lacks permission, returns false so UI can omit option or redirect.
 */
export function canAccessScreen(screen: Screen, user: User | null): boolean {
  // Public screens accessible to anyone (guest or authenticated)
  if (screen === "landing" || screen === "customer") {
    return true;
  }

  // If unauthenticated guest, only public screens are allowed
  if (!user) {
    return false;
  }

  const role = user.role;

  switch (role) {
    case "HQ_SuperAdmin":
      // SuperAdmin has unrestricted access to all screens
      return true;

    case "Franchise_Owner":
      // Franchise owner can access customer, store operations, store list, reports, inventory
      // bom-studio is reserved for HQ Supply Chain / R&D
      return [
        "landing",
        "customer",
        "pos",
        "kds",
        "transfers",
        "stores",
        "inventory",
        "analytics",
      ].includes(screen);

    case "Store_Manager":
      // Store manager operates store POS, KDS, store-level STO, store inventory, store analytics
      // Cannot create new franchise stores or alter master BoM recipes
      return [
        "landing",
        "customer",
        "pos",
        "kds",
        "transfers",
        "inventory",
        "analytics",
      ].includes(screen);

    case "Supply_Chain_Officer":
      // Supply chain officer manages STO, all inventory ledgers, BoM studio costing
      return [
        "landing",
        "customer",
        "transfers",
        "inventory",
        "bom-studio",
      ].includes(screen);

    case "POS_Cashier":
      // Cashier only has POS cashier terminal, kitchen KDS monitoring, and customer menu
      return ["landing", "customer", "pos", "kds"].includes(screen);

    default:
      // Unknown / generic role defaults to false (public screens already handled above)
      return false;
  }
}

/**
 * Check if user can enter or view links for a portal
 */
export function canAccessPortal(portal: Portal, user: User | null): boolean {
  if (portal === "landing" || portal === "customer") {
    return true;
  }

  if (!user) {
    return false;
  }

  const role = user.role;

  if (portal === "staff") {
    // POS_Cashier, Store_Manager, Franchise_Owner, HQ_SuperAdmin can access staff
    // Supply Chain Officer also can access STO in staff portal
    return [
      "HQ_SuperAdmin",
      "Franchise_Owner",
      "Store_Manager",
      "POS_Cashier",
      "Supply_Chain_Officer",
    ].includes(role);
  }

  if (portal === "admin") {
    // POS_Cashier CANNOT access admin portal
    return [
      "HQ_SuperAdmin",
      "Franchise_Owner",
      "Store_Manager",
      "Supply_Chain_Officer",
    ].includes(role);
  }

  return false;
}

/**
 * Determine default destination screen when switching role or redirecting unauthorized access
 */
export function getDefaultScreenForUser(user: User | null): Screen {
  if (!user) return "customer";

  switch (user.role) {
    case "HQ_SuperAdmin":
      return "analytics";
    case "Franchise_Owner":
      return "analytics";
    case "Store_Manager":
      return "pos";
    case "Supply_Chain_Officer":
      return "transfers";
    case "POS_Cashier":
      return "pos";
    default:
      return "customer";
  }
}

/**
 * Filter staff navigation tabs according to user permissions
 */
export function filterStaffNavItems<T extends { id: Screen }>(
  items: T[],
  user: User | null
): T[] {
  return items.filter((item) => canAccessScreen(item.id, user));
}

/**
 * Filter admin navigation tabs according to user permissions
 */
export function filterAdminNavItems<T extends { id: Screen }>(
  items: T[],
  user: User | null
): T[] {
  return items.filter((item) => canAccessScreen(item.id, user));
}
