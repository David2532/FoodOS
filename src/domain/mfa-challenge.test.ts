import { describe, expect, it } from "vitest";
import { MAX_MFA_CHALLENGE_ATTEMPTS, mfaChallengeRetryPolicy } from "./mfa-challenge";

describe("mfaChallengeRetryPolicy", () => {
  it("applies bounded increasing delays before locking the current challenge screen", () => {
    expect(mfaChallengeRetryPolicy(0)).toEqual({ locked: false, retryAfterSeconds: 0 });
    expect(mfaChallengeRetryPolicy(1)).toEqual({ locked: false, retryAfterSeconds: 5 });
    expect(mfaChallengeRetryPolicy(2)).toEqual({ locked: false, retryAfterSeconds: 15 });
    expect(mfaChallengeRetryPolicy(4)).toEqual({ locked: false, retryAfterSeconds: 60 });
    expect(mfaChallengeRetryPolicy(MAX_MFA_CHALLENGE_ATTEMPTS)).toEqual({ locked: true, retryAfterSeconds: 0 });
    expect(mfaChallengeRetryPolicy(99)).toEqual({ locked: true, retryAfterSeconds: 0 });
  });

  it("treats invalid counters as a fresh screen", () => {
    expect(mfaChallengeRetryPolicy(Number.NaN)).toEqual({ locked: false, retryAfterSeconds: 0 });
    expect(mfaChallengeRetryPolicy(-1)).toEqual({ locked: false, retryAfterSeconds: 0 });
  });
});
