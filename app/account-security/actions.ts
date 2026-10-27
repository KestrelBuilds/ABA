"use server";
import { identity } from "@/lib/supabase/server";
import { z } from "zod";
export type MfaResult = {
  ok: boolean;
  message: string;
  factorId?: string;
  qr?: string;
};
export async function enrollAuthenticator(): Promise<MfaResult> {
  try {
    const { db, user } = await identity(true, true);
    const ready = await db.rpc("owner_mfa_ready");
    if (ready.error || ready.data !== true)
      return {
        ok: false,
        message:
          "Apply the owner MFA database setup file first. No authenticator has been created.",
      };
    if (user.factors?.some((f) => f.status === "verified"))
      return {
        ok: false,
        message: "An authenticator is already enabled. Enter its code below.",
      };
    // Remove only stale unverified TOTP enrollments belonging to this authenticated owner.
    const factors = await db.auth.mfa.listFactors();
    if (factors.error) throw Error();
    for (const f of factors.data.all.filter(
      (f) => f.status === "unverified" && f.factor_type === "totp",
    )) {
      const removed = await db.auth.mfa.unenroll({ factorId: f.id });
      if (removed.error) throw Error();
    }
    const enrollment = await db.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ABA Studio owner",
    });
    if (enrollment.error) throw Error();
    return {
      ok: true,
      message:
        "Scan this QR code with your authenticator app, then enter its six-digit code. Keep authenticator backups securely; the QR code is a secret.",
      factorId: enrollment.data.id,
      qr: enrollment.data.totp.qr_code,
    };
  } catch {
    return {
      ok: false,
      message:
        "Authenticator setup could not be completed. Check Supabase Auth MFA settings and try again.",
    };
  }
}
export async function verifyAuthenticator(form: FormData): Promise<MfaResult> {
  try {
    const { db } = await identity(true, true);
    const factorId = z.uuid().parse(form.get("factorId"));
    const code = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("code"));
    const factors = await db.auth.mfa.listFactors();
    if (
      factors.error ||
      !factors.data.all.some(
        (f) => f.id === factorId && f.factor_type === "totp",
      )
    )
      throw Error();
    const verification = await db.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verification.error)
      return {
        ok: false,
        message:
          "That code was not accepted. Check the current code and try again.",
      };
    return {
      ok: true,
      message:
        "Authenticator verified. Your owner workspace now requires this extra check on new sign-ins.",
    };
  } catch {
    return {
      ok: false,
      message: "Enter the current six-digit code from your authenticator app.",
    };
  }
}
