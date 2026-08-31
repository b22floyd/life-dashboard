import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

// A minimal stand-in for the slice of the Supabase query builder
// checkRateLimit actually uses (select/insert/update, each terminating in
// either .maybeSingle() or resolving directly) — backed by an in-memory
// row per (user_id, action) rather than mocking the whole chainable API.
function createFakeSupabase(initialRows: { user_id: string; action: string; window_start: string; count: number }[] = []) {
  const rows = [...initialRows];

  function find(userId: string, action: string) {
    return rows.find((r) => r.user_id === userId && r.action === action);
  }

  const client = {
    from() {
      return {
        select() {
          return {
            eq(_col: string, userId: string) {
              return {
                eq(_col2: string, action: string) {
                  return {
                    maybeSingle: async () => ({ data: find(userId, action) ?? null }),
                  };
                },
              };
            },
          };
        },
        insert(row: { user_id: string; action: string; window_start: string; count: number }) {
          rows.push(row);
          return Promise.resolve({ data: null, error: null });
        },
        update(patch: Partial<{ window_start: string; count: number }>) {
          return {
            eq(_col: string, userId: string) {
              return {
                eq(_col2: string, action: string) {
                  const row = find(userId, action);
                  if (row) Object.assign(row, patch);
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, rows };
}

describe("checkRateLimit", () => {
  const HOUR = 60 * 60 * 1000;

  it("allows the first request and creates a counter row", async () => {
    const { client, rows } = createFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake mirrors only the used subset of SupabaseClient
    const result = await checkRateLimit(client as any, "user-1", "transcribeAudio", 3, HOUR);
    expect(result).toEqual({ allowed: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "user-1", action: "transcribeAudio", count: 1 });
  });

  it("allows requests under the limit and increments the counter", async () => {
    const { client, rows } = createFakeSupabase([
      { user_id: "user-1", action: "transcribeAudio", window_start: new Date().toISOString(), count: 1 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(client as any, "user-1", "transcribeAudio", 3, HOUR);
    expect(result).toEqual({ allowed: true });
    expect(rows[0].count).toBe(2);
  });

  it("denies a request once the limit is reached within the window", async () => {
    const { client } = createFakeSupabase([
      { user_id: "user-1", action: "transcribeAudio", window_start: new Date().toISOString(), count: 3 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(client as any, "user-1", "transcribeAudio", 3, HOUR);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });

  it("resets the counter once the window has elapsed", async () => {
    const staleWindowStart = new Date(Date.now() - HOUR - 1000).toISOString();
    const { client, rows } = createFakeSupabase([
      { user_id: "user-1", action: "transcribeAudio", window_start: staleWindowStart, count: 3 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(client as any, "user-1", "transcribeAudio", 3, HOUR);
    expect(result).toEqual({ allowed: true });
    expect(rows[0].count).toBe(1);
  });

  it("tracks separate counters per action for the same user", async () => {
    const { client, rows } = createFakeSupabase([
      { user_id: "user-1", action: "transcribeAudio", window_start: new Date().toISOString(), count: 3 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkRateLimit(client as any, "user-1", "parseWorkoutText", 3, HOUR);
    expect(result).toEqual({ allowed: true });
    expect(rows).toHaveLength(2);
  });
});
