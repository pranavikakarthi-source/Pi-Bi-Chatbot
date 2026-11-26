/**
 * Ensures a public Supabase Storage bucket exists before uploading media.
 */
export async function ensurePublicBucket(
  adminSupabase,
  bucketName,
  { fileSizeLimit, allowedMimeTypes } = {}
) {
  const { data: existing, error: getError } =
    await adminSupabase.storage.getBucket(bucketName);

  if (existing && !getError) return;

  const { error: createError } = await adminSupabase.storage.createBucket(
    bucketName,
    {
      public: true,
      fileSizeLimit,
      allowedMimeTypes,
    }
  );

  if (
    createError &&
    !createError.message?.toLowerCase().includes("already exists")
  ) {
    throw new Error(
      createError.message || `Failed to initialize ${bucketName} storage bucket.`
    );
  }
}
