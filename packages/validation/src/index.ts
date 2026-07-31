import { z } from 'zod';
import { Category } from '@deltaora/shared-types';

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createPageSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  title: z.string().min(1, "Title is required").max(100),
  category: z.nativeEnum(Category).default(Category.GENERAL),
  checkInterval: z.number().min(5).max(10080).default(60), // 5 min to 1 week
});

export const updatePageSchema = createPageSchema.partial();
