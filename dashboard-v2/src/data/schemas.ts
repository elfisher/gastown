import { z } from "zod";

// --- Rig ---
export const RigSchema = z.object({
  name: z.string(),
  beads_prefix: z.string(),
  status: z.string(),
  witness: z.string(),
  refinery: z.string(),
  polecats: z.number(),
  crew: z.number(),
});
export type Rig = z.infer<typeof RigSchema>;
export const RigListSchema = z.array(RigSchema);

export const AgentSchema = z.object({
  name: z.string(),
  rig: z.string(),
  role: z.enum(["mayor", "deacon", "witness", "refinery", "polecat", "crew", "boot"]),
  session: z.string(),
  status: z.enum(["working", "idle", "dead"]),
  runtime: z.string().optional(),
  startedAt: z.string(),
  lastActivity: z.string(),
  currentWork: z.string().optional(),
  preview: z.string().optional(),
});

export const AgentListSchema = z.array(AgentSchema);

export type Agent = z.infer<typeof AgentSchema>;

export const MayorMessageSchema = z.object({
  sender: z.enum(["mayor", "human", "system"]),
  text: z.string(),
  timestamp: z.string(),
  isAction: z.boolean().optional(),
});

export const MayorMessageListSchema = z.array(MayorMessageSchema);

export type MayorMessage = z.infer<typeof MayorMessageSchema>;

// --- Bead ---
export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.number(),
  issue_type: z.string(),
  assignee: z.string().optional(),
  owner: z.string().optional(),
  created_at: z.string(),
  created_by: z.string().optional(),
  updated_at: z.string(),
  closed_at: z.string().optional(),
  close_reason: z.string().optional(),
  labels: z.array(z.string()).optional(),
  dependency_count: z.number().optional(),
  dependent_count: z.number().optional(),
  comment_count: z.number().optional(),
});
export type Bead = z.infer<typeof BeadSchema>;
export const BeadListSchema = z.array(BeadSchema);

// --- Bead with deps (from bd show --json) ---
export const BeadDepSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.number(),
  dependency_type: z.string().optional(),
});
export type BeadDep = z.infer<typeof BeadDepSchema>;

export const BeadDetailSchema = BeadSchema.extend({
  dependencies: z.array(BeadDepSchema).optional(),
  dependents: z.array(BeadDepSchema).optional(),
});
export type BeadDetail = z.infer<typeof BeadDetailSchema>;

// --- Convoy ---
export const ConvoySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  issues: z.array(z.string()).optional(),
  issue_count: z.number().optional(),
});
export type Convoy = z.infer<typeof ConvoySchema>;
export const ConvoyListSchema = z.array(ConvoySchema);

// --- Agent ---
export const AgentSchema = z.object({
  name: z.string(),
  rig: z.string().optional(),
  role: z.string(),
  status: z.string().optional(),
  session_id: z.string().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;
export const AgentListSchema = z.array(AgentSchema);

// --- Event (from gt feed --plain) ---
export const EventSchema = z.object({
  timestamp: z.string(),
  source: z.string(),
  action: z.string(),
  detail: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;

// --- TmuxSession ---
export const TmuxSessionSchema = z.object({
  name: z.string(),
  created: z.string().optional(),
  attached: z.boolean().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type TmuxSession = z.infer<typeof TmuxSessionSchema>;

// --- GitDiff ---
export const GitDiffSchema = z.object({
  hash: z.string(),
  author: z.string(),
  date: z.string(),
  message: z.string(),
});
export type GitDiff = z.infer<typeof GitDiffSchema>;
export const GitLogSchema = z.array(GitDiffSchema);
