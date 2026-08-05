import { describe, expect, it } from "vitest";
import { necessaryOnlyPrivacyChoices, parseCurrentPrivacyChoices, PRIVACY_NOTICE_VERSION } from "./privacy";

describe("Q-PRIV-CONSENT-UNIT-001 privacy choices", () => {
  it("keeps every nonessential purpose disabled in the necessary-only state", () => {
    expect(necessaryOnlyPrivacyChoices()).toEqual({
      noticeVersion: PRIVACY_NOTICE_VERSION,
      ageConfirmed: true,
      termsAccepted: true,
      sensitiveProfile: false,
      analytics: false,
      marketing: false,
      imageCloudProcessing: false,
      offContribution: false,
      advertising: false
    });
  });

  it("accepts independent optional choices without enabling neighboring purposes", () => {
    const parsed = parseCurrentPrivacyChoices({
      ...necessaryOnlyPrivacyChoices(),
      analytics: true,
      imageCloudProcessing: true
    });
    expect(parsed).toMatchObject({ analytics: true, imageCloudProcessing: true, marketing: false, advertising: false });
  });

  it("rejects missing eligibility, acknowledgement and stale notice versions", () => {
    expect(parseCurrentPrivacyChoices({ ...necessaryOnlyPrivacyChoices(), ageConfirmed: false })).toBeNull();
    expect(parseCurrentPrivacyChoices({ ...necessaryOnlyPrivacyChoices(), termsAccepted: false })).toBeNull();
    expect(parseCurrentPrivacyChoices({ ...necessaryOnlyPrivacyChoices(), noticeVersion: "old" })).toBeNull();
  });
});
