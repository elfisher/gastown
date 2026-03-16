import { z } from "zod";

export const RigSchema = z.object({
  name: z.string(),
  beads_prefix: z.string(),
  status: z.string(),
  witness: z.string(),
  refinery: z.string(),
  polecats: z.number(),
  crew: z.number(),
});

export const RigListSchema = z.array(RigSchema);

export type Rig = z.infer<typeof RigSchema>;
