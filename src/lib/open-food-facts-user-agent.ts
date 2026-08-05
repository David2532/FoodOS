const identifiableUserAgent = /^[^/\s()]+\/[^\s()]+\s+\((?:[^\s()]+@[^\s()]+|https:\/\/[^\s()]+)\)$/;

export function getOpenFoodFactsUserAgent(value = process.env.OPEN_FOOD_FACTS_USER_AGENT): string | undefined {
  const candidate = value?.trim();
  return candidate && candidate.length <= 200 && identifiableUserAgent.test(candidate) ? candidate : undefined;
}

export function requireOpenFoodFactsUserAgent(value = process.env.OPEN_FOOD_FACTS_USER_AGENT): string {
  const userAgent = getOpenFoodFactsUserAgent(value);
  if (!userAgent) throw new Error("OPEN_FOOD_FACTS_USER_AGENT must be an identifiable App/Version (contact email or HTTPS URL) value.");
  return userAgent;
}
