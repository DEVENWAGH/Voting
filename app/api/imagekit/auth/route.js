/**
 * POST /api/imagekit/auth
 * Returns a short-lived ImageKit authentication token for client-side uploads.
 * Required by the ImageKit SDK when uploading directly from the browser.
 */
import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';

export const dynamic = 'force-dynamic';

let _ik = null;
function getImageKit() {
  if (!_ik) {
    _ik = new ImageKit({
      publicKey:  process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  return _ik;
}

export async function GET() {
  try {
    const auth = getImageKit().getAuthenticationParameters();
    return NextResponse.json(auth);
  } catch (err) {
    console.error('[imagekit/auth]', err);
    return NextResponse.json({ error: 'ImageKit auth failed' }, { status: 500 });
  }
}
