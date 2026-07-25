import { NextRequest, NextResponse } from "next/server";
import { apiError, withTimeout } from "@/lib/api";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ barcode: string }> }) {
  try {
    const { barcode } = await params;
    if (!/^\d{8,14}$/.test(barcode)) return NextResponse.json({ error: { code: "INVALID_BARCODE", message: "Enter an 8–14 digit barcode." } }, { status: 400 });
    const fields = [
      "code", "product_name", "generic_name", "brands", "categories",
      "categories_tags", "ingredients_text", "ingredients", "additives_tags",
      "nutriments", "nutrition_data_per", "serving_size", "image_front_url",
      "allergens", "allergens_tags", "labels", "labels_tags", "countries",
      "quantity", "completeness",
    ].join(",");
    const response = await withTimeout(fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
      headers: { "User-Agent": "BumpSafe-Hackathon/1.0 (https://github.com/aarontran321/hackthevalley)" },
      next: { revalidate: 3600 }
    }), 12000);
    if (!response.ok) throw new Error("PRODUCT_LOOKUP_FAILED");
    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      // Preserve the scan so the analysis route can still return a transparent
      // report instead of terminating the user's flow at the lookup step.
      return NextResponse.json({
        product: {
          code: barcode,
          product_name: `Unidentified product (${barcode})`,
          lookup_status: "not_found",
          lookup_note: "No matching Open Food Facts record was available. A package photo or ingredient list is needed for a specific conclusion.",
        },
      });
    }
    return NextResponse.json({ product: data.product });
  } catch (error) {
    return apiError(error);
  }
}
