import { NextRequest, NextResponse } from 'next/server';
import { testSmtpConnection, type EmailSettings } from '@/lib/services/emailService';

/**
 * POST /api/settings/email/test
 *
 * Test SMTP connection with the provided settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword'] as const;
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const settings: EmailSettings = {
      enabled: true,
      provider: body.provider || 'other',
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpUser: body.smtpUser,
      smtpPassword: body.smtpPassword,
      fromEmail: body.fromEmail || '',
      fromName: body.fromName || '',
    };

    const result = await testSmtpConnection(settings);

    if (result.success) {
      return NextResponse.json({
        data: { success: true },
        message: 'SMTP connection successful',
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'SMTP connection failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Error testing SMTP connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test SMTP connection' },
      { status: 500 }
    );
  }
}
