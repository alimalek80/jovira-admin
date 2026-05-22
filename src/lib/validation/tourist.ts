import { z } from "zod";

export const touristSexOptions = ["MALE", "FEMALE"] as const;
export const touristAgeTypeOptions = ["ADULT", "CHILD", "INFANT"] as const;

export const touristSchema = z.object({
  reservation: z.number().int().positive(),
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  sex: z.enum(touristSexOptions, {
    error: "Sex must be MALE or FEMALE.",
  }),
  age_type: z.enum(touristAgeTypeOptions, {
    error: "Age type must be ADULT, CHILD, or INFANT.",
  }),
  passport_number: z.string().trim().optional().or(z.literal("")),
  nationality: z.string().trim().optional().or(z.literal("")),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be YYYY-MM-DD.").optional().or(z.literal("")),
  passport_expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Passport expiry date must be YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
});

export type TouristFormValues = z.infer<typeof touristSchema>;

export function sanitizeTouristInput(values: TouristFormValues): TouristFormValues {
  return {
    reservation: values.reservation,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    sex: values.sex,
    age_type: values.age_type,
    passport_number: values.passport_number?.trim() ?? "",
    nationality: values.nationality?.trim() ?? "",
    birth_date: values.birth_date ?? "",
    passport_expiry_date: values.passport_expiry_date ?? "",
  };
}
