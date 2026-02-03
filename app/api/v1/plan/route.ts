/**
 * API v1 Plan endpoint - exposes ISP engine to external platforms
 * POST /api/v1/plan
 */

import { NextRequest, NextResponse } from "next/server";
import type { FormInputs, FeedbackEvent, StudentState, Plan } from "@/lib/engine/types";
import { calculateCapacity } from "@/lib/engine/capacity";
import { deriveInitialState, applyFeedbackEvents } from "@/lib/engine/state";
import { generatePlanFromState } from "@/lib/engine/generator";
import { getTodayISO, getNowISO } from "@/lib/utils/date";

// ============================================================================
// Types
// ============================================================================

export interface PlanRequest {
  todayISO?: string;
  inputs: FormInputs;
  events?: FeedbackEvent[];
  state?: StudentState;
  debug?: boolean;
}

interface ValidationResult {
  valid: true;
  data: PlanRequest;
}

interface ValidationError {
  valid: false;
  error: string;
}

// ============================================================================
// Validation
// ============================================================================

function validatePlanRequest(body: unknown): ValidationResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const o = body as Record<string, unknown>;

  if (!o.inputs || typeof o.inputs !== "object") {
    return { valid: false, error: "inputs is required" };
  }

  const inputs = o.inputs as Record<string, unknown>;

  if (typeof inputs.examDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(inputs.examDate)) {
    return { valid: false, error: "inputs.examDate must be YYYY-MM-DD" };
  }

  if (
    !Array.isArray(inputs.availabilityHoursByWeekday) ||
    inputs.availabilityHoursByWeekday.length !== 7
  ) {
    return { valid: false, error: "inputs.availabilityHoursByWeekday must be array of 7 numbers" };
  }

  for (let i = 0; i < 7; i++) {
    const v = inputs.availabilityHoursByWeekday[i];
    if (typeof v !== "number" || v < 0 || !Number.isFinite(v)) {
      return { valid: false, error: `inputs.availabilityHoursByWeekday[${i}] must be non-negative number` };
    }
  }

  if (typeof inputs.presentedBefore !== "boolean") {
    return { valid: false, error: "inputs.presentedBefore must be boolean" };
  }

  if (typeof inputs.alreadyStudying !== "boolean") {
    return { valid: false, error: "inputs.alreadyStudying must be boolean" };
  }

  if (typeof inputs.region !== "string") {
    return { valid: false, error: "inputs.region must be string" };
  }

  if (inputs.stage !== "Infantil" && inputs.stage !== "Primaria") {
    return { valid: false, error: "inputs.stage must be Infantil or Primaria" };
  }

  const formInputs: FormInputs = {
    examDate: inputs.examDate as string,
    availabilityHoursByWeekday: inputs.availabilityHoursByWeekday as number[],
    presentedBefore: inputs.presentedBefore as boolean,
    alreadyStudying: inputs.alreadyStudying as boolean,
    region: inputs.region as string,
    stage: inputs.stage as "Infantil" | "Primaria",
  };
  if (inputs.studentType === "new" || inputs.studentType === "repeat") formInputs.studentType = inputs.studentType;
  if (inputs.themesCount === 15 || inputs.themesCount === 20 || inputs.themesCount === 25) formInputs.themesCount = inputs.themesCount;
  if (typeof inputs.planProgramming === "boolean") formInputs.planProgramming = inputs.planProgramming;

  const data: PlanRequest = {
    inputs: formInputs,
  };

  if (o.todayISO !== undefined) {
    if (typeof o.todayISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.todayISO)) {
      return { valid: false, error: "todayISO must be YYYY-MM-DD if provided" };
    }
    data.todayISO = o.todayISO;
  }

  if (o.events !== undefined) {
    if (!Array.isArray(o.events)) {
      return { valid: false, error: "events must be array if provided" };
    }
    data.events = o.events as FeedbackEvent[];
  }

  if (o.state !== undefined) {
    if (!o.state || typeof o.state !== "object") {
      return { valid: false, error: "state must be object if provided" };
    }
    data.state = o.state as StudentState;
  }

  if (o.debug !== undefined) {
    if (typeof o.debug !== "boolean") {
      return { valid: false, error: "debug must be boolean if provided" };
    }
    data.debug = o.debug;
  }

  return { valid: true, data };
}

// ============================================================================
// Helpers
// ============================================================================

function checkAuth(request: NextRequest): boolean {
  const apiKey = process.env.SELVIA_API_KEY;
  if (!apiKey) {
    return process.env.NODE_ENV === "development";
  }
  const header = request.headers.get("x-selvia-api-key");
  return header === apiKey;
}

function corsHeaders(): Record<string, string> {
  const origin = process.env.SELVIA_CORS_ORIGIN;
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type,x-selvia-api-key",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function jsonResponse(
  body: object,
  status: number,
  extraHeaders: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(), ...extraHeaders },
  });
}

// ============================================================================
// Handlers
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const validation = validatePlanRequest(body);
  if (!validation.valid) {
    return jsonResponse({ ok: false, error: validation.error }, 400);
  }

  const { todayISO, inputs, events, state: providedState, debug = false } = validation.data;

  const today = todayISO ?? getTodayISO();
  const capacity = calculateCapacity(inputs, { todayISO: today });
  let studentState = providedState ?? deriveInitialState(inputs, capacity, today);

  if (events?.length) {
    studentState = applyFeedbackEvents(studentState, events);
  }

  const plan = generatePlanFromState(inputs, studentState, { todayISO: today }) as Plan;

  let planOut: Plan = plan;
  if (!debug && "debugInfo" in plan) {
    planOut = { ...plan, debugInfo: undefined };
  }

  return jsonResponse(
    {
      ok: true,
      version: "v1",
      plan: planOut,
      state: studentState,
      meta: {
        generatedAt: getNowISO(),
        todayISO: today,
      },
    },
    200
  );
}
