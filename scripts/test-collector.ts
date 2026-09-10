#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Prisma EmailProviderMetric model...');
  
  const testDate = new Date();
  testDate.setUTCDate(testDate.getUTCDate() - 1);
  testDate.setUTCHours(0, 0, 0, 0);
  
  try {
    // Create test record
    const testRecord = await prisma.emailProviderMetric.create({
      data: {
        provider: 'resend',
        date: testDate,
        sent: 100,
        delivered: 95,
        bounced: 2,
        complained: 0,
        unsubscribed: 0,
        opened: 45,
        clicked: 15,
        uniqueOpened: 40,
        uniqueClicked: 10,
        hardBounce: 1,
        softBounce: 1,
        deliveryRate: 0.95,
        openRate: 0.89,
        clickRate: 0.11,
        bounceRate: 0.02,
        complaintRate: 0,
      },
    });
    
    console.log('✅ Created test record:', testRecord.id);
    
    // Read it back
    const fetched = await prisma.emailProviderMetric.findUnique({
      where: {
        provider_date: {
          provider: 'resend',
          date: testDate,
        },
      },
    });
    
    console.log('🔍 Fetched record:', fetched ? '✅ Found' : '❌ Not found');
    
    // Update it
    const updated = await prisma.emailProviderMetric.update({
      where: { id: testRecord.id },
      data: {
        delivered: 96,
        bounced: 3,
      },
    });
    
    console.log('✅ Updated record:', updated.id);
    
    // Clean up
    await prisma.emailProviderMetric.delete({
      where: { id: testRecord.id },
    });
    
    console.log('🧹 Cleanup complete');
    console.log('✅ Test passed!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

main();