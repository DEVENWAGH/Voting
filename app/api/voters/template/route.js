/**
 * GET /api/voters/template
 * Returns a downloadable CSV template for voter bulk upload.
 */
import { NextResponse } from 'next/server';

const TEMPLATE = `name,email,phone,gender,age
John Doe,john.doe@example.com,9876543210,Male,25
Jane Smith,jane.smith@example.com,,Female,30
Alice Brown,alice@example.com,,,
`;

export async function GET() {
  return new NextResponse(TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="voter_upload_template.csv"',
    },
  });
}
