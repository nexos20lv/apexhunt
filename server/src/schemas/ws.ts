import { z } from 'zod';

export const PlayerRoleSchema = z.enum(['runner', 'hunter', 'spectator']);
export type PlayerRole = z.infer<typeof PlayerRoleSchema>;

export const GameStateSchema = z.enum([
  'lobby',
  'head_start',
  'hunting',
  'game_over',
]);
export type GameState = z.infer<typeof GameStateSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    roomCode: z.string().min(3).max(10),
    playerName: z.string().min(1).max(25),
    isHost: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('set_role'),
    role: PlayerRoleSchema,
  }),
  z.object({
    type: z.literal('update_position'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
  }),
  z.object({
    type: z.literal('start_game'),
  }),
  z.object({
    type: z.literal('restart_game'),
  }),
  z.object({
    type: z.literal('claim_capture'),
    code: z.string().length(4),
  }),
  z.object({
    type: z.literal('use_perk'),
    perk: z.enum(['ghost', 'decoy', 'sonar_flash', 'triangulation']),
  }),
  z.object({
    type: z.literal('update_settings'),
    settings: z.object({
      durationMinutes: z.number().min(5).max(180).optional(),
      headStartMinutes: z.number().min(0).max(30).optional(),
      pingIntervalSeconds: z.number().min(15).max(600).optional(),
      zoneRadiusMeters: z.number().min(50).max(50000).optional(),
      shrinkEnabled: z.boolean().optional(),
      shrinkIntervalMinutes: z.number().min(1).max(30).optional(),
      shrinkStepMeters: z.number().min(10).max(1000).optional(),
      minZoneRadiusMeters: z.number().min(20).max(5000).optional(),
      zoneCenter: z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
        .optional(),
    }),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
