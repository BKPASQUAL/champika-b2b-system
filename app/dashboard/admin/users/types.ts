import { UserRole } from "@/app/config/nav-config";

export type UserStatus = "Active" | "Inactive" | "Suspended";

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string;
  businessId?: string | null; // Added businessId
  businessName?: string | null; // Added for display
}

export interface UserFormData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  businessId?: string; // Added businessId
}