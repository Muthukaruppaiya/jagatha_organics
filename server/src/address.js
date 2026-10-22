export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

export function cleanPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(-10);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  else if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function readAddress(body) {
  const address = {
    name: text(body?.name ?? body?.customerName, 80),
    phone: cleanPhone(body?.phone),
    pincode: String(body?.pincode || '').replace(/\D/g, ''),
    locality: text(body?.locality, 120),
    addressLine: text(body?.addressLine, 300),
    city: text(body?.city, 80),
    state: text(body?.state, 60),
    landmark: text(body?.landmark, 120),
    altPhone: cleanPhone(body?.altPhone),
    addressType: body?.addressType === 'work' ? 'work' : 'home',
  };
  if (address.name.length < 2) throw fail('Enter the name.');
  if (!/^\d{10}$/.test(address.phone)) throw fail('Enter a 10-digit mobile number.');
  if (!/^\d{6}$/.test(address.pincode)) throw fail('Enter a 6-digit pincode.');
  if (address.locality.length < 2) throw fail('Enter the locality.');
  if (address.addressLine.length < 6) throw fail('Enter the address (house no, building, street, area).');
  if (address.city.length < 2) throw fail('Enter the city, district, or town.');
  if (!STATES.includes(address.state)) throw fail('Choose the state.');
  if (address.altPhone && !/^\d{10}$/.test(address.altPhone)) throw fail('Enter a 10-digit alternate phone, or leave it blank.');
  return address;
}

export function mapAddress(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    pincode: row.pincode,
    locality: row.locality,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    landmark: row.landmark,
    altPhone: row.alt_phone,
    addressType: row.address_type,
  };
}
