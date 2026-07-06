/**
 * SLA policy and mailbox configuration.
 *
 * The dashboard is built for a single transactional intake mailbox. The live
 * mailbox address and SLA thresholds are configurable via environment
 * variables so the same build can point at different mailboxes/policies.
 */
export const MAILBOX_ADDRESS =
  process.env.MAILBOX_ADDRESS ?? "FAHQ-RA-GOFlexBLRTransactional@firstam.com";

/** Minutes allowed to send a first response / acknowledgement. */
export const ACK_SLA_MINUTES = Number(process.env.ACK_SLA_MINUTES ?? 15);

/** Minutes allowed to fully resolve / complete an email. */
export const COMPLETION_SLA_MINUTES = Number(
  process.env.COMPLETION_SLA_MINUTES ?? 4 * 60
);
