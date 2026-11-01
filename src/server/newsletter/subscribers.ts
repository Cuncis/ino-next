import { eq } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { randomString } from "@/lib/random";

/** Newsletter subscribers, ported from App\Models\Subscriber. */
export type Subscriber = typeof subscribers.$inferSelect;

export const SUBSCRIBED = "berlangganan";
export const UNSUBSCRIBED = "berhenti";

/**
 * Signs an address up on the person's own request (the footer form, or the chat's
 * opt-in box). Someone already subscribed is left alone; someone who unsubscribed and
 * asks again is choosing to come back, so they are subscribed again.
 */
export async function subscribeEmail(email: string): Promise<Subscriber> {
  const address = email.trim().toLowerCase();
  const now = new Date();
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, address)).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(subscribers)
      .values({ email: address, status: SUBSCRIBED, unsubscribeToken: randomString(64), subscribedAt: now, createdAt: now, updatedAt: now })
      // two sign-ups racing for one address: the other one won, which is the same outcome
      .onConflictDoNothing({ target: subscribers.email })
      .returning();

    return created ?? (await db.select().from(subscribers).where(eq(subscribers.email, address)).limit(1))[0];
  }

  if (existing.status !== SUBSCRIBED) {
    const [updated] = await db
      .update(subscribers)
      .set({ status: SUBSCRIBED, subscribedAt: now, unsubscribedAt: null, updatedAt: now })
      .where(eq(subscribers.id, existing.id))
      .returning();

    return updated;
  }

  return existing;
}

export async function subscriberByToken(token: string): Promise<Subscriber | null> {
  const [subscriber] = await db.select().from(subscribers).where(eq(subscribers.unsubscribeToken, token)).limit(1);

  return subscriber ?? null;
}

export async function unsubscribe(subscriber: Subscriber): Promise<Subscriber> {
  if (subscriber.status !== SUBSCRIBED) {
    return subscriber;
  }

  const now = new Date();
  const [updated] = await db.update(subscribers).set({ status: UNSUBSCRIBED, unsubscribedAt: now, updatedAt: now }).where(eq(subscribers.id, subscriber.id)).returning();

  return updated;
}
