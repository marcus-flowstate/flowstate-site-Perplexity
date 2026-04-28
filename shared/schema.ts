import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const demoRequests = sqliteTable("demo_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company").notNull(),
  jobTitle: text("job_title"),
  message: text("message"),
  createdAt: text("created_at").notNull(),
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests)
  .omit({ id: true, createdAt: true })
  .extend({
    firstName: z.string().min(1, "First name is required").max(80),
    lastName: z.string().min(1, "Last name is required").max(80),
    email: z.string().email("Please enter a valid email"),
    phone: z.string().max(40).optional().or(z.literal("")),
    company: z.string().min(1, "Company is required").max(120),
    jobTitle: z.string().max(120).optional().or(z.literal("")),
    message: z.string().max(2000).optional().or(z.literal("")),
  });

export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;
