import { z } from "zod";

export const prefsUpdateSchema = z
  .object({
    lessonReminder: z.boolean().optional(),
    streakRisk: z.boolean().optional(),
    churnPrevention: z.boolean().optional(),
    duelEvents: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    timezone: z
      .string()
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid IANA timezone" },
      )
      .optional(),
  })
  .strict();

export type PrefsUpdate = z.infer<typeof prefsUpdateSchema>;
