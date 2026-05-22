/**
 * GET /api/voters/template
 * Returns a downloadable CSV template for voter bulk upload.
 */
import { NextResponse } from 'next/server';

const TEMPLATE = `name,email,phone,member_id,role,notes
John Doe,john.doe@example.com,9876543210,CS2023001,student,Optional notes here
Jane Smith,jane.smith@example.com,,EMP-4521,employee,Phone is optional
Alice Brown,alice@example.com,,MEM-001,member,
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
