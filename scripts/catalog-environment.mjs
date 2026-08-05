function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function catalogServerConfiguration(environment = process.env) {
  const url = nonBlank(environment.SUPABASE_URL) ?? nonBlank(environment.NEXT_PUBLIC_SUPABASE_URL);
  const secretKey = nonBlank(environment.SUPABASE_SECRET_KEY);
  const legacyServiceRoleKey = nonBlank(environment.SUPABASE_SERVICE_ROLE_KEY);

  return {
    url,
    credential: secretKey ?? legacyServiceRoleKey,
    credentialKind: secretKey ? "secret" : legacyServiceRoleKey ? "service-role" : undefined
  };
}
