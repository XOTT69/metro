export type LiveVehicle = {
  id: string;
  routeId: string;
  label: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  timestamp: number;
};

type Cursor = { offset: number };

function readVarint(bytes: Uint8Array, cursor: Cursor) {
  let value = 0;
  let shift = 0;
  while (cursor.offset < bytes.length) {
    const byte = bytes[cursor.offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return value;
    shift += 7;
    if (shift > 56) break;
  }
  return value;
}

function readBytes(bytes: Uint8Array, cursor: Cursor) {
  const length = readVarint(bytes, cursor);
  const result = bytes.subarray(cursor.offset, cursor.offset + length);
  cursor.offset += length;
  return result;
}

function readString(bytes: Uint8Array, cursor: Cursor) {
  return new TextDecoder().decode(readBytes(bytes, cursor));
}

function readFloat(bytes: Uint8Array, cursor: Cursor) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + cursor.offset, 4);
  const value = view.getFloat32(0, true);
  cursor.offset += 4;
  return value;
}

function skipField(bytes: Uint8Array, cursor: Cursor, wire: number) {
  if (wire === 0) readVarint(bytes, cursor);
  else if (wire === 1) cursor.offset += 8;
  else if (wire === 2) {
    const length = readVarint(bytes, cursor);
    cursor.offset += length;
  }
  else if (wire === 5) cursor.offset += 4;
  else cursor.offset = bytes.length;
}

function parseTrip(bytes: Uint8Array) {
  const cursor = { offset: 0 };
  let routeId = "";
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 5 && wire === 2) routeId = readString(bytes, cursor);
    else skipField(bytes, cursor, wire);
  }
  return routeId;
}

function parsePosition(bytes: Uint8Array) {
  const cursor = { offset: 0 };
  const position = { latitude: 0, longitude: 0, bearing: 0, speed: 0 };
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 5 && field === 1) position.latitude = readFloat(bytes, cursor);
    else if (wire === 5 && field === 2) position.longitude = readFloat(bytes, cursor);
    else if (wire === 5 && field === 3) position.bearing = readFloat(bytes, cursor);
    else if (wire === 5 && field === 5) position.speed = readFloat(bytes, cursor);
    else skipField(bytes, cursor, wire);
  }
  return position;
}

function parseDescriptor(bytes: Uint8Array) {
  const cursor = { offset: 0 };
  let id = "";
  let label = "";
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 2 && field === 1) id = readString(bytes, cursor);
    else if (wire === 2 && field === 2) label = readString(bytes, cursor);
    else skipField(bytes, cursor, wire);
  }
  return { id, label };
}

function parseVehicle(bytes: Uint8Array, entityId: string): LiveVehicle | null {
  const cursor = { offset: 0 };
  let routeId = "";
  let timestamp = 0;
  let position = { latitude: 0, longitude: 0, bearing: 0, speed: 0 };
  let descriptor = { id: entityId, label: "" };
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 2 && field === 1) routeId = parseTrip(readBytes(bytes, cursor));
    else if (wire === 2 && field === 2) position = parsePosition(readBytes(bytes, cursor));
    else if (wire === 0 && field === 5) timestamp = readVarint(bytes, cursor);
    else if (wire === 2 && field === 8) descriptor = parseDescriptor(readBytes(bytes, cursor));
    else skipField(bytes, cursor, wire);
  }
  if (!routeId || !position.latitude || !position.longitude) return null;
  return {
    id: descriptor.id || entityId,
    routeId,
    label: descriptor.label,
    ...position,
    timestamp,
  };
}

function parseEntity(bytes: Uint8Array) {
  const cursor = { offset: 0 };
  let id = "";
  let vehicleBytes: Uint8Array | null = null;
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 2 && field === 1) id = readString(bytes, cursor);
    else if (wire === 2 && field === 4) vehicleBytes = readBytes(bytes, cursor);
    else skipField(bytes, cursor, wire);
  }
  return vehicleBytes ? parseVehicle(vehicleBytes, id) : null;
}

export function decodeGtfsRealtime(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const cursor = { offset: 0 };
  const vehicles: LiveVehicle[] = [];
  while (cursor.offset < bytes.length) {
    const tag = readVarint(bytes, cursor);
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 2 && field === 2) {
      const vehicle = parseEntity(readBytes(bytes, cursor));
      if (vehicle) vehicles.push(vehicle);
    } else {
      skipField(bytes, cursor, wire);
    }
  }
  return vehicles;
}
