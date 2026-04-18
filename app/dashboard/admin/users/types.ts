import { UserRole } from "@/app/config/nav-config";

export type UserStatus = "Active" | "Inactive" | "Suspended";

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  lastActive: string;
  businessId?: string | null;
  businessName?: string | null;
  accessibleBusinessIds?: string[];
}

export interface UserFormData {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  businessId: string;               // primary business ID
  accessibleBusinessIds: string[];  // all accessible businesses (includes primary)
}