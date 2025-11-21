import { z } from "zod";

// Schema for Creating a User
export const createUserSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "office", "rep", "delivery"]),
  status: z
    .enum(["Active", "Inactive", "Suspended"])
    .optional()
    .default("Active"),
});

// Schema for Updating a User (Password is optional here)
export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")), // Allow empty string to ignore
  role: z.enum(["admin", "office", "rep", "delivery"]).optional(),
  status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
});

// Schema for Status Toggle
export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});
