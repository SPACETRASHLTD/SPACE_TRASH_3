/**
 * Overture REST API client.
 *
 * STATUS: stub. The exact endpoint paths, auth header format, and
 * response shapes are documented inside the agency's Overture Settings
 * page (Settings → API). We need to grab that doc and fill these in.
 *
 * Plan for first methods we'll need:
 *   - listContacts({page, limit})        → map our artist_id ↔ Overture contact_id
 *   - listBookings({from, to})           → pull agency-confirmed bookings into busy_blocks
 *   - createBooking({contact_id, ...})   → write a booking when an artist accepts an SMS offer
 *
 * Auth: assume header `Authorization: Bearer <api_key>` per typical
 * REST conventions; correct once we see the docs. Some APIs use
 * `X-API-Key: <key>` instead — easy switch.
 */

import { z } from "zod";

export interface OvertureClientConfig {
  apiKey: string;
  baseUrl: string;
}

export class OvertureClient {
  constructor(private readonly cfg: OvertureClientConfig) {}

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      // TODO: confirm exact header format from Overture API docs.
      Authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit & { schema?: z.ZodSchema<T> } = {},
  ): Promise<T> {
    const url = new URL(path, this.cfg.baseUrl).toString();
    const res = await fetch(url, { ...init, headers: { ...this.headers(), ...init.headers } });
    if (!res.ok) {
      const body = await res.text();
      throw new OvertureError(res.status, `${res.status} ${res.statusText}: ${body}`);
    }
    const json = await res.json();
    if (init.schema) return init.schema.parse(json);
    return json as T;
  }

  // ──────────────────────────────────────────────────────────────────
  // Methods below are placeholders — signatures and paths to be confirmed
  // against the actual Overture API docs.
  // ──────────────────────────────────────────────────────────────────

  async listContacts(_opts: { page?: number; limit?: number } = {}): Promise<unknown> {
    throw new Error("OvertureClient.listContacts: not implemented yet — needs Overture API docs.");
  }

  async listBookings(_opts: { from: Date; to: Date }): Promise<unknown> {
    throw new Error("OvertureClient.listBookings: not implemented yet — needs Overture API docs.");
  }

  async createBooking(_opts: {
    contact_id: string;
    start: Date;
    end: Date;
    venue?: string;
    fee_cents?: number;
    notes?: string;
  }): Promise<unknown> {
    throw new Error("OvertureClient.createBooking: not implemented yet — needs Overture API docs.");
  }
}

export class OvertureError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OvertureError";
  }
}
