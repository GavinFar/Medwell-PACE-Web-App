import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, scrubMetadata } from "./audit-utils";

export type AuditOutcome = "success" | "failure" | "flagged";

export type AuditEvent = {
  action: string; // e.g. "checkin.attempt", "event.create", "role.change"
  outcome: AuditOutcome;
  actorId?: string | null; // the signed-in user's id, if any
  actorRole?: string | null; // their role at the time
  targetType?: string; // e.g. "event", "check_in", "user"
  targetId?: string;
  reasonCode?: string; // e.g. "OUT_OF_RANGE", "ALREADY_CHECKED_IN"
  metadata?: Record<string, unknown>; // extra detail; never codes, tokens or GPS
  headers?: Headers; // pass request.headers to record a hashed IP
  requestId?: string;
};

// Writes one row to the audit log. Never throws: if logging fails, the error
// is reported to the server console and the function returns false, so a
// logging problem can't break the user's request.
//
// Example:
//   await logAudit({
//     action: "checkin.attempt",
//     outcome: "failure",
//     actorId: user.id,
//     actorRole: "participant",
//     targetType: "event",
//     targetId: eventId,
//     reasonCode: "OUT_OF_RANGE",
//     metadata: { distance_m: 412 },
//     headers: request.headers,
//   });
export async function logAudit(event: AuditEvent): Promise<boolean> {
  try {
    const ip = event.headers ? clientIp(event.headers) : null;
    const { error } = await createAdminClient()
      .from("audit_log")
      .insert({
        request_id: event.requestId ?? randomUUID(),
        actor_id: event.actorId ?? null,
        actor_role: event.actorRole ?? null,
        action: event.action,
        target_type: event.targetType ?? null,
        target_id: event.targetId ?? null,
        outcome: event.outcome,
        reason_code: event.reasonCode ?? null,
        ip_hash: hashIp(ip, process.env.AUDIT_IP_HASH_KEY),
        metadata: scrubMetadata(event.metadata ?? {}),
      });

    if (error) {
      console.error(`audit_log write failed (${event.action}): ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`audit_log write failed (${event.action}):`, e instanceof Error ? e.message : e);
    return false;
  }
}