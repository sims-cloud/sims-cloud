import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // ==========================================
    // CHECK ENVIRONMENT VARIABLES
    // ==========================================
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("Supabase environment variables missing");

      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // SERVER-SIDE SUPABASE CLIENT
    // ==========================================
    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // ==========================================
    // READ DATA FROM ESP32
    // ==========================================
    const body = await request.json();

    const deviceCode = body.device_code;

    if (!deviceCode) {
      return NextResponse.json(
        {
          success: false,
          message: "device_code is required",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // FIND DEVICE
    // ==========================================
    const { data: device, error: deviceError } =
      await supabase
        .from("devices")
        .select(
          "id, device_code, patient_id, total_doses, remaining_doses"
        )
        .eq("device_code", deviceCode)
        .single();

    if (deviceError || !device) {
      console.error("Device error:", deviceError);

      return NextResponse.json(
        {
          success: false,
          message: "Device not found",
        },
        { status: 404 }
      );
    }

    // ==========================================
    // CALCULATE NEW REMAINING DOSES
    // ==========================================
    const currentRemaining =
      device.remaining_doses ?? device.total_doses ?? 0;

    const newRemaining = Math.max(
      currentRemaining - 1,
      0
    );

    // ==========================================
    // INSERT USAGE RECORD
    // ==========================================
    const { data: usageRecord, error: usageError } =
      await supabase
        .from("inhaler_usage")
        .insert({
          device_id: device.id,
          patient_id: device.patient_id,

          // Button is temporarily simulating
          // the inhaler pressure sensor
          sensor_value: null,

          activation_detected: true,
          remaining_doses: newRemaining,
          used_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (usageError) {
      console.error("Usage insert error:", usageError);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to save inhaler usage",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // UPDATE DEVICE
    // ==========================================
    const { error: updateError } = await supabase
      .from("devices")
      .update({
        remaining_doses: newRemaining,
        status: "online",
        last_sync: new Date().toISOString(),
      })
      .eq("id", device.id);

    if (updateError) {
      console.error("Device update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Usage saved but device status could not be updated",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // SUCCESS
    // ==========================================
    return NextResponse.json(
      {
        success: true,
        message: "Inhaler usage recorded",
        device_code: device.device_code,
        remaining_doses: newRemaining,
        usage_id: usageRecord.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}