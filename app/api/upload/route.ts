// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `product-images/${fileName}`;

    // Upload to Supabase Storage (Bucket: 'products')
    const bucketName = "products";
    let { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError && ((uploadError as any).statusCode === "404" || uploadError.message === "Bucket not found" || (uploadError as any).status === 400)) {
      console.log(`Bucket '${bucketName}' not found. Attempting to create it...`);
      // Try to create the bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true, 
      });
      
      if (createError) {
         console.error("Failed to create bucket:", createError);
         throw createError;
      }
      
      console.log(`Bucket '${bucketName}' created successfully. Retrying upload...`);
      // Retry upload
      const { error: retryError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });
        
      if (retryError) {
        throw retryError;
      }
      uploadError = null; // Clear error since retry succeeded
    } else if (uploadError) {
      throw uploadError;
    }

    // Get Public URL
    const { data } = supabaseAdmin.storage
      .from("products")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
