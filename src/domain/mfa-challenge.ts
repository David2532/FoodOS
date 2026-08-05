export const MAX_MFA_CHALLENGE_ATTEMPTS = 5;

const MFA_RETRY_DELAYS_SECONDS = [5, 15, 30, 60] as const;

export type MfaChallengeRetryPolicy = {
  locked: boolean;
  retryAfterSeconds: number;
};

export function mfaChallengeRetryPolicy(failedAttempts: number): MfaChallengeRetryPolicy {
  if (!Number.isFinite(failedAttempts) || failedAttempts <= 0) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  const attempts = Math.floor(failedAttempts);
  if (attempts >= MAX_MFA_CHALLENGE_ATTEMPTS) {
    return { locked: true, retryAfterSeconds: 0 };
  }
  return {
    locked: false,
    retryAfterSeconds: MFA_RETRY_DELAYS_SECONDS[Math.min(attempts - 1, MFA_RETRY_DELAYS_SECONDS.length - 1)]
  };
}
