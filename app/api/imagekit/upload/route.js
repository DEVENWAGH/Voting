/**
 * POST /api/imagekit/upload
 * Server-side candidate photo upload to ImageKit CDN.
 * Body: multipart/form-data with `file` field.
 */
import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';

let _ik = null;
function getImageKit() {
  if (!_ik) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error('ImageKit is not configured. Set IMAGEKIT_* env variables.');
    }
    _ik = new ImageKit({ publicKey, privateKey, urlEndpoint });
  }
  return _ik;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = (formData.get('folder') || 'candidates').toString();

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, or GIF images are allowed.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await getImageKit().upload({
      file: buffer,
      fileName: file.name,
      folder: `/${folder}`,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      thumbnailUrl: result.thumbnailUrl,
    });
  } catch (err) {
    console.error('[imagekit/upload]', err);
    return NextResponse.json(
      { error: err.message || 'Image upload failed' },
      { status: err.message?.includes('not configured') ? 503 : 500 },
    );
  }
}
