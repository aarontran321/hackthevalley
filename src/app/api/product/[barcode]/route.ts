import { NextRequest, NextResponse } from "next/server";
import { apiError, withTimeout } from "@/lib/api";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ barcode: string }> }) {
  try {
    const { barcode } = await params;
    if (!/^\d{8,14}$/.test(barcode)) return NextResponse.json({ error: { code: "INVALID_BARCODE", message: "Enter an 8–14 digit barcode." } }, { status: 400 });
    const response = await withTimeout(fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,ingredients_text,nutriments,serving_size,image_front_url,allergens_tags`, {
      headers: { "User-Agent": "BumpSafe-Hackathon/1.0 (https://github.com/aarontran321/hackthevalley)" },
      next: { revalidate: 3600 }
    }), 12000);
    if (!response.ok) throw new Error("PRODUCT_LOOKUP_FAILED");
    const data = await response.json();
    if (data.status !== 1 || !data.product) return NextResponse.json({ error: { code: "PRODUCT_NOT_FOUND", message: "We couldn’t find that product. Try a photo or text search instead." } }, { status: 404 });
    return NextResponse.json({ product: data.product });
  } catch (error) {
    return apiError(error);
  }
}
