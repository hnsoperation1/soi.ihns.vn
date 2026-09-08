import { NextRequest, NextResponse } from "next/server";
import { lookupBooking } from "@/lib/lookup";
import { formatBooking, type FormatStyle } from "@/lib/format";

export const maxDuration = 60;

const STYLES: FormatStyle[] = ["en", "vi-short", "en-long"];

export async function POST(req: NextRequest) {
  const { code, lastName, firstName } = await req.json();

  if (!code || !lastName || !firstName) {
    return NextResponse.json({ error: "Thiếu mã đặt chỗ, họ hoặc tên." }, { status: 400 });
  }

  try {
    const result = await lookupBooking(String(code).trim(), String(lastName).trim(), String(firstName).trim());

    if (!result.status) {
      return NextResponse.json({ error: result.message || "Không tìm thấy đặt chỗ." }, { status: 404 });
    }

    const formats = Object.fromEntries(
      STYLES.map((style) => [style, formatBooking(result.reservation, style)])
    );

    return NextResponse.json({ formats });
  } catch (err) {
    console.error("[lookup] failed:", err);
    return NextResponse.json(
      { error: "Vietjet tạm thời không phản hồi. Vui lòng thử lại." },
      { status: 502 }
    );
  }
}
