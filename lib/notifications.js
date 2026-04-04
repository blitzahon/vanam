import { canSendSmsForEvent, getNotificationSettings, recordNotificationDispatch } from "@/lib/db";

export async function dispatchSmsForEvent(event) {
  const settings = await getNotificationSettings();

  if (!settings.smsEnabled) {
    return { status: "disabled" };
  }

  if (!settings.hasTwilioConfig) {
    return { status: "missing-config" };
  }

  const recipients = event.eventType === "Accident" ? settings.accidentRecipients : settings.animalRecipients;
  if (!recipients.length) {
    return { status: "no-recipients" };
  }

  const cooldown = await canSendSmsForEvent(event.eventType, settings.cooldownSeconds);
  if (!cooldown.allowed) {
    return { status: "cooldown", retryAfterSeconds: cooldown.retryAfterSeconds ?? settings.cooldownSeconds };
  }

  const message = buildEventMessage(event);
  const results = [];

  for (const recipient of recipients) {
    const result = await sendSms({
      to: recipient,
      body: message
    });

    await recordNotificationDispatch({
      channel: "sms",
      eventType: event.eventType,
      recipient,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.sid ?? null,
      responseBody: result.rawBody
    });

    results.push(result);
  }

  return {
    status: results.every((result) => result.ok) ? "sent" : "partial",
    results
  };
}

export async function sendTestSms(input) {
  const settings = await getNotificationSettings();

  if (!settings.hasTwilioConfig) {
    throw new Error("Twilio credentials are not configured in environment variables.");
  }

  const to = String(input.to ?? "").trim();
  if (!to) {
    throw new Error("Recipient phone number is required.");
  }

  const message = String(input.message ?? "").trim() || "VANAM test alert: SMS delivery path verified.";
  const result = await sendSms({ to, body: message });

  await recordNotificationDispatch({
    channel: "sms",
    eventType: "Test",
    recipient: to,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.sid ?? null,
    responseBody: result.rawBody
  });

  if (!result.ok) {
    throw new Error(result.error ?? "SMS dispatch failed.");
  }

  return result;
}

async function sendSms({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: body
    }).toString()
  });

  const rawBody = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: parsed?.message ?? `Twilio request failed with status ${response.status}.`,
      rawBody
    };
  }

  return {
    ok: true,
    sid: parsed?.sid ?? null,
    rawBody
  };
}

function buildEventMessage(event) {
  const parts = [
    `VANAM ${event.eventType} alert`,
    `${event.objectType}`,
    `camera ${event.cameraId}`,
    `${event.confidencePct}% confidence`
  ];

  if (event.zonePath) {
    parts.push(`route ${event.zonePath}`);
  }

  return parts.join(" | ");
}
