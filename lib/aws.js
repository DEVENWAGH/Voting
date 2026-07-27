import { RekognitionClient, CreateCollectionCommand, IndexFacesCommand, SearchFacesByImageCommand, DeleteFacesCommand } from '@aws-sdk/client-rekognition';

let client = null;

export function getRekognitionClient() {
  if (!client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      return null;
    }

    client = new RekognitionClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return client;
}

const COLLECTION_ID = 'block-vote-voters';

export async function ensureCollectionExists() {
  const rekClient = getRekognitionClient();
  if (!rekClient) return false;

  try {
    const command = new CreateCollectionCommand({ CollectionId: COLLECTION_ID });
    await rekClient.send(command);
    console.log(`[aws] Rekognition collection '${COLLECTION_ID}' created successfully.`);
    return true;
  } catch (err) {
    if (err.name === 'ResourceAlreadyExistsException' || err.message?.includes('already exists')) {
      return true; // Already exists, all good
    }
    console.error('[aws] Failed to ensure Rekognition collection exists:', err);
    return false;
  }
}

// Convert base64 Data URL to Buffer
function base64ToBuffer(base64Image) {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

export async function indexFaceFromBase64(nullifierHash, base64Image) {
  const rekClient = getRekognitionClient();
  if (!rekClient) return null;

  await ensureCollectionExists();

  try {
    const imageBytes = base64ToBuffer(base64Image);
    const command = new IndexFacesCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBytes },
      ExternalImageId: nullifierHash, // Associate with nullifierHash
      MaxFaces: 1,
      DetectionAttributes: ['DEFAULT'],
    });

    const response = await rekClient.send(command);
    if (response.FaceRecords && response.FaceRecords.length > 0) {
      const faceId = response.FaceRecords[0].Face.FaceId;
      const confidence = response.FaceRecords[0].Face.Confidence;
      return { faceId, confidence };
    }
    return null;
  } catch (err) {
    console.error('[aws] IndexFaces failed:', err);
    return null;
  }
}

export async function searchFaceFromBase64(base64Image, maxFaces = 5, threshold = 85) {
  const rekClient = getRekognitionClient();
  if (!rekClient) return [];

  try {
    const imageBytes = base64ToBuffer(base64Image);
    const command = new SearchFacesByImageCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBytes },
      MaxFaces: maxFaces,
      FaceMatchThreshold: threshold,
    });

    const response = await rekClient.send(command);
    if (response.FaceMatches && response.FaceMatches.length > 0) {
      return response.FaceMatches.map(match => ({
        faceId: match.Face.FaceId,
        nullifierHash: match.Face.ExternalImageId,
        similarity: match.Similarity,
      }));
    }
    return [];
  } catch (err) {
    console.error('[aws] SearchFacesByImage failed:', err);
    return [];
  }
}

export async function deleteFaceFromCollection(faceId) {
  const rekClient = getRekognitionClient();
  if (!rekClient || !faceId) return false;

  try {
    const command = new DeleteFacesCommand({
      CollectionId: COLLECTION_ID,
      FaceIds: [faceId],
    });
    await rekClient.send(command);
    console.log(`[aws] Deleted faceId '${faceId}' from collection.`);
    return true;
  } catch (err) {
    console.error('[aws] DeleteFaces failed:', err);
    return false;
  }
}
