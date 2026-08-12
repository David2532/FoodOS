import { NextResponse } from "next/server";

export function GET(request: Request): Response {
  return NextResponse.redirect(new URL("/icon.svg", request.url), 308);
}
