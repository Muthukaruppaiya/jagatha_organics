const GRAPH = 'https://graph.facebook.com/v21.0';

function intlPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length >= 12) return digits.slice(0, 12);
  return digits;
}

async function postMessage(phoneId, token, payload) {
  const response = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body?.error?.message || `WhatsApp ${response.status}`;
    const code = body?.error?.code;
    return { sent: false, error, code };
  }
  return { sent: true, id: body?.messages?.[0]?.id || '' };
}

function cleanText(value, max) {
  return String(value || '').replace(/[\n\r\t]+/g, ' ').trim().slice(0, max);
}

function languages() {
  return [...new Set([
    String(process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en',
    'en',
    'en_US',
  ])];
}

async function sendTemplate(phone, templateName, parameters, { button = false } = {}) {
  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!token || !phoneId) return { sent: false, skipped: true };
  const to = intlPhone(phone);
  if (to.length < 11) return { sent: false, error: 'Missing mobile number.' };
  const bodyParameters = parameters.map((text) => ({ type: 'text', text: cleanText(text, 80) || '-' }));

  let last = { sent: false, error: 'WhatsApp send failed.' };
  for (const language of languages()) {
    const components = [{ type: 'body', parameters: bodyParameters }];
    if (button) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: bodyParameters[0]?.text || '-' }],
      });
    }
    last = await postMessage(phoneId, token, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    });
    if (last.sent) return last;
    if (last.code !== 132001 && last.code !== 132000) break;
  }
  return last;
}

export async function sendWhatsAppOtp(phone, code) {
  const template = String(process.env.WHATSAPP_TEMPLATE || 'jagatha_otp').trim();
  const result = await sendTemplate(phone, template, [String(code)], { button: true });
  if (!result.sent && !result.skipped) console.error('WhatsApp OTP failed:', result.error);
  return result;
}

export async function sendOrderConfirmed({ phone, name, orderNumber, totalPaise }) {
  const template = String(process.env.WHATSAPP_ORDER_TEMPLATE || 'order_confirmation').trim();
  const amount = `Rs ${Math.round(Number(totalPaise || 0) / 100)}`;
  const result = await sendTemplate(phone, template, [name || 'there', orderNumber, amount]);
  if (!result.sent && !result.skipped) console.error('WhatsApp order message failed:', result.error);
  return result;
}
