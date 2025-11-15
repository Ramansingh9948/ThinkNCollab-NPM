export async function uploadFile(file) {
  // Later: upload to S3/Cloudinary
  // For now: just return a fake URL
  return `https://fake-storage.com/${file.name}`;
}
