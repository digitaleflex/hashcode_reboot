/**
 * Email Deliverability Alerting System
 * 
 * Checks metrics against thresholds and sends alerts via email/Slack.
 * Can be called from the collector script or run as a separate cron.
 */

import { PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/mail';

const prisma = new PrismaClient();

// ─── Thresholds Configuration ─────────────────────────────────────────────

export interface AlertThresholds {
  /** Bounce rate threshold (e.g., 0.05 = 5%) */
  bounceRate: number;
  /** Complaint rate threshold (e.g., 0.001 = 0.1%) */
  complaintRate: number;
  /** Minimum delivery rate (e.g., 0.95 = 95%) */
  deliveryRate: number;
  /** Drop rate vs 7 days ago (e.g., 0.20 = 20% drop) */
  dropRate: number;
  /** Minimum open rate (e.g., 0.15 = 15%) */
  openRate?: number;
  /** Minimum click rate (e.g., 0.02 = 2%) */
  clickRate?: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  bounceRate: 0.05,      // 5%
  complaintRate: 0.001,  // 0.1%
  deliveryRate: 0.95,    // 95%
  dropRate: 0.20,        // 20% drop vs 7 days ago
  openRate: 0.15,        // 15%
  clickRate: 0.02,       // 2%
};

export interface Alert {
  provider: string;
  date: Date;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface AlertResult {
  alerts: Alert[];
  hasCritical: boolean;
  hasWarning: boolean;
}

// ─── Alert Checking ───────────────────────────────────────────────────────

/**
 * Check metrics for a specific provider and date against thresholds.
 * Also compares with 7 days ago to detect drops.
 */
export async function checkMetricsAgainstThresholds(
  provider: string,
  date: Date,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<AlertResult> {
  const alerts: Alert[] = [];
  
  // Get current day metrics
  const current = await prisma.emailProviderMetric.findUnique({
    where: { provider_date: { provider, date } },
  });
  
  if (!current) {
    return { alerts: [], hasCritical: false, hasWarning: false };
  }
  
  // Get 7 days ago for comparison
  const sevenDaysAgo = new Date(date);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  
  const previous = await prisma.emailProviderMetric.findUnique({
    where: { provider_date: { provider, date: sevenDaysAgo } },
  });
  
  // Helper to add alert
  const addAlert = (
    metric: string,
    value: number | null | undefined,
    threshold: number,
    severity: 'warning' | 'critical',
    message: string
  ) => {
    if (value === null || value === undefined) return;
    alerts.push({ provider, date, metric, value, threshold, severity, message });
  };
  
  // Check bounce rate
  if (current.bounceRate !== null) {
    const severity = current.bounceRate > thresholds.bounceRate * 2 ? 'critical' : 'warning';
    addAlert('bounceRate', current.bounceRate, thresholds.bounceRate, severity,
      `Bounce rate ${(current.bounceRate * 100).toFixed(2)}% exceeds ${(thresholds.bounceRate * 100).toFixed(1)}%`);
  }
  
  // Check complaint rate
  if (current.complaintRate !== null) {
    const severity = current.complaintRate > thresholds.complaintRate * 2 ? 'critical' : 'warning';
    addAlert('complaintRate', current.complaintRate, thresholds.complaintRate, severity,
      `Complaint rate ${(current.complaintRate * 100).toFixed(3)}% exceeds ${(thresholds.complaintRate * 100).toFixed(2)}%`);
  }
  
  // Check delivery rate
  if (current.deliveryRate !== null) {
    const severity = current.deliveryRate < thresholds.deliveryRate * 0.9 ? 'critical' : 'warning';
    addAlert('deliveryRate', current.deliveryRate, thresholds.deliveryRate, severity,
      `Delivery rate ${(current.deliveryRate * 100).toFixed(1)}% below ${(thresholds.deliveryRate * 100).toFixed(1)}%`);
  }
  
  // Check open rate
  if (thresholds.openRate && current.openRate !== null) {
    const severity = current.openRate < thresholds.openRate * 0.7 ? 'critical' : 'warning';
    addAlert('openRate', current.openRate, thresholds.openRate, severity,
      `Open rate ${(current.openRate * 100).toFixed(1)}% below ${(thresholds.openRate * 100).toFixed(1)}%`);
  }
  
  // Check click rate
  if (thresholds.clickRate && current.clickRate !== null) {
    const severity = current.clickRate < thresholds.clickRate * 0.7 ? 'critical' : 'warning';
    addAlert('clickRate', current.clickRate, thresholds.clickRate, severity,
      `Click rate ${(current.clickRate * 100).toFixed(2)}% below ${(thresholds.clickRate * 100).toFixed(1)}%`);
  }
  
  // Check drop vs 7 days ago
  if (previous) {
    const checkDrop = (metric: keyof typeof current, label: string) => {
      const currVal = current[metric] as number | null;
      const prevVal = previous[metric] as number | null;
      if (currVal === null || prevVal === null || prevVal === 0) return;
      const drop = (prevVal - currVal) / prevVal;
      if (drop > thresholds.dropRate) {
        addAlert(`${metric}Drop`, drop, thresholds.dropRate, 'warning',
          `${label} dropped ${(drop * 100).toFixed(1)}% vs 7 days ago (${prevVal} → ${currVal})`);
      }
    };
    
    checkDrop('deliveryRate', 'Delivery rate');
    checkDrop('openRate', 'Open rate');
    checkDrop('clickRate', 'Click rate');
    checkDrop('sent', 'Volume sent');
  }
  
  const hasCritical = alerts.some(a => a.severity === 'critical');
  const hasWarning = alerts.some(a => a.severity === 'warning');
  
  return { alerts, hasCritical, hasWarning };
}

/**
 * Check all providers for a given date
 */
export async function checkAllProviders(
  date: Date,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<AlertResult> {
  const providers = ['resend', 'brevo'];
  const allAlerts: Alert[] = [];
  
  for (const provider of providers) {
    const result = await checkMetricsAgainstThresholds(provider, date, thresholds);
    allAlerts.push(...result.alerts);
  }
  
  return {
    alerts: allAlerts,
    hasCritical: allAlerts.some(a => a.severity === 'critical'),
    hasWarning: allAlerts.some(a => a.severity === 'warning'),
  };
}

// ─── Alert Notifications ──────────────────────────────────────────────────

interface AlertNotificationConfig {
  /** Email addresses to notify */
  emails?: string[];
  /** Slack webhook URL */
  slackWebhook?: string;
  /** Only notify on critical (not warnings) */
  criticalOnly?: boolean;
}

const DEFAULT_NOTIFICATION_CONFIG: AlertNotificationConfig = {
  emails: process.env.ALERT_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [],
  slackWebhook: process.env.ALERT_SLACK_WEBHOOK,
  criticalOnly: false,
};

/**
 * Send alert notifications via email and/or Slack
 */
export async function sendAlertNotifications(
  result: AlertResult,
  config: AlertNotificationConfig = DEFAULT_NOTIFICATION_CONFIG
): Promise<void> {
  const { alerts, hasCritical, hasWarning } = result;
  
  if (alerts.length === 0) return;
  
  if (config.criticalOnly && !hasCritical) return;
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  
  const subject = hasCritical
    ? `🔴 CRITICAL: Email Deliverability Alerts (${alerts.length})`
    : `🟡 WARNING: Email Deliverability Alerts (${alerts.length})`;
  
  // Build email content
  const html = buildAlertEmail(alerts, hasCritical);
  const text = buildAlertText(alerts, hasCritical);
  
  // Send emails
  if (config.emails && config.emails.length > 0) {
    for (const email of config.emails) {
      try {
        await sendEmail({
          to: email,
          subject,
          html,
          text,
        });
      } catch (err) {
        console.error(`Failed to send alert email to ${email}:`, err);
      }
    }
  }
  
  // Send Slack
  if (config.slackWebhook) {
    try {
      await sendSlackAlert(alerts, hasCritical, config.slackWebhook);
    } catch (err) {
      console.error('Failed to send Slack alert:', err);
    }
  }
}

function buildAlertEmail(alerts: Alert[], hasCritical: boolean): string {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  
  const rows = alerts.map(a => `
    <tr style="background: ${a.severity === 'critical' ? '#FEF2F2' : '#FFFBEB'};">
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${a.severity === 'critical' ? '#FEE2E2' : '#FEF3C7'}; color: ${a.severity === 'critical' ? '#991B1B' : '#92400E'};">
          ${a.severity.toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; font-family: monospace; font-size: 13px;">${a.provider.toUpperCase()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${a.date.toISOString().split('T')[0]}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${a.metric}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${(a.value * 100).toFixed(2)}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; font-family: monospace;">${(a.threshold * 100).toFixed(2)}%</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${a.message}</td>
    </tr>
  `).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F2937; max-width: 800px; margin: 0 auto; padding: 24px;">
  <div style="background: ${hasCritical ? '#FEF2F2' : '#FFFBEB'}; border: 1px solid ${hasCritical ? '#FECACA' : '#FDE68A'}; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; color: ${hasCritical ? '#991B1B' : '#92400E'}; font-size: 20px;">
      ${hasCritical ? '🔴 Critical Alerts' : '🟡 Warning Alerts'} - Email Deliverability
    </h1>
    <p style="margin: 0; color: ${hasCritical ? '#991B1B' : '#92400E'};">${alerts.length} alert(s) triggered</p>
  </div>
  
  <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
    <thead>
      <tr style="background: #F9FAFB; border-bottom: 2px solid #E5E7EB;">
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Severity</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Provider</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Date</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Metric</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Value</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Threshold</th>
        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6B7280;">Details</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  
  <p style="margin-top: 24px; padding: 16px; background: #F9FAFB; border-radius: 8px; font-size: 13px; color: #6B7280;">
    <strong>Thresholds configured:</strong><br>
    Bounce rate: ${(DEFAULT_THRESHOLDS.bounceRate * 100).toFixed(1)}% | 
    Complaint rate: ${(DEFAULT_THRESHOLDS.complaintRate * 100).toFixed(2)}% | 
    Delivery rate: ${(DEFAULT_THRESHOLDS.deliveryRate * 100).toFixed(1)}% | 
    Drop vs 7d: ${(DEFAULT_THRESHOLDS.dropRate * 100).toFixed(0)}%
  </p>
  
  <p style="margin-top: 16px; font-size: 12px; color: #9CA3AF;">
    This alert was generated automatically by the HASHCODE Email Deliverability Monitor.
    <br>Check the dashboard at <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://reboot.joinhashcode.com'}/admin/email-deliverability" style="color: #C5F441;">/admin/email-deliverability</a>
  </p>
</body>
</html>
  `;
}

function buildAlertText(alerts: Alert[], hasCritical: boolean): string {
  const lines = [
    `${hasCritical ? '🔴 CRITICAL' : '🟡 WARNING'} - Email Deliverability Alerts`,
    `${alerts.length} alert(s) triggered`,
    '',
  ];
  
  for (const a of alerts) {
    lines.push(
      `[${a.severity.toUpperCase()}] ${a.provider.toUpperCase()} - ${a.date.toISOString().split('T')[0]}`,
      `  ${a.metric}: ${(a.value * 100).toFixed(2)}% (threshold: ${(a.threshold * 100).toFixed(2)}%)`,
      `  ${a.message}`,
      ''
    );
  }
  
  return lines.join('\n');
}

async function sendSlackAlert(alerts: Alert[], hasCritical: boolean, webhookUrl: string): Promise<void> {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  
  const fields = alerts.map(a => ({
    title: `${a.provider.toUpperCase()} - ${a.metric}`,
    value: `${(a.value * 100).toFixed(2)}% (threshold: ${(a.threshold * 100).toFixed(2)}%)\n${a.message}`,
    short: true,
  }));
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'HASHCODE Email Monitor',
      icon_emoji: hasCritical ? ':red_circle:' : ':warning:',
      attachments: [{
        color: hasCritical ? '#DC2626' : '#F59E0B',
        title: `${hasCritical ? '🔴 Critical' : '🟡 Warning'} Email Deliverability Alerts`,
        text: `${alerts.length} alert(s) triggered`,
        fields,
        footer: 'HASHCODE Email Deliverability Monitor',
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}

// ─── Convenience: Run check and notify ────────────────────────────────────

export async function runAlertCheck(
  date?: Date,
  thresholds?: AlertThresholds,
  config?: AlertNotificationConfig
): Promise<AlertResult> {
  const checkDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: yesterday
  checkDate.setUTCHours(0, 0, 0, 0);
  
  const result = await checkAllProviders(checkDate, thresholds);
  
  if (result.alerts.length > 0) {
    await sendAlertNotifications(result, config);
  }
  
  return result;
}