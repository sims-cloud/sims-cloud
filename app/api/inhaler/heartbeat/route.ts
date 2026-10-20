import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error",
        },
        { status: 500 }
      );
    }

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

    const { data: device, error: deviceError } =
      await supabase
        .from("devices")
        .select("id, device_code")
        .eq("device_code", deviceCode)
        .single();

    if (deviceError || !device) {
      console.error(
        "Heartbeat device error:",
        deviceError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Device not found",
        },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from("devices")
      .update({
        status: "online",
        last_sync: new Date().toISOString(),
      })
      .eq("id", device.id);

    if (updateError) {
      console.error(
        "Heartbeat update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to update device heartbeat",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Heartbeat received",
        device_code: device.device_code,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Heartbeat API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}