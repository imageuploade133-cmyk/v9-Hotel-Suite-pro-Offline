/**
 * Web Bluetooth ESC/POS Printer Utility for Handheld All-In-One POS Phone Terminals
 */

export interface BluetoothDeviceConfig {
  name?: string;
  id?: string;
  connected: boolean;
}

let activeDevice: any = null;
let activeCharacteristic: any = null;

export async function requestBluetoothPrinter(): Promise<boolean> {
  if (typeof window === 'undefined' || !('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth is not supported on this browser or device.');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
        '0000e025-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Common ESC/POS Bluetooth service
      ],
    });

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    if (!services || services.length === 0) {
      throw new Error('No Bluetooth GATT services found on device.');
    }

    let targetCharacteristic: any = null;
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          targetCharacteristic = char;
          break;
        }
      }
      if (targetCharacteristic) break;
    }

    if (!targetCharacteristic) {
      throw new Error('No writeable characteristic found on Bluetooth printer.');
    }

    activeDevice = device;
    activeCharacteristic = targetCharacteristic;
    return true;
  } catch (err: any) {
    console.error('Bluetooth printer pairing error:', err);
    throw err;
  }
}

export async function printEscPosBluetooth(text: string): Promise<boolean> {
  if (!activeCharacteristic) {
    const paired = await requestBluetoothPrinter();
    if (!paired || !activeCharacteristic) {
      throw new Error('Bluetooth printer not connected.');
    }
  }

  try {
    // ESC/POS Initialization commands
    const ESC = 0x1b;
    const GS = 0x1d;

    const initCmd = new Uint8Array([ESC, 0x40]); // Initialize printer
    const alignCenter = new Uint8Array([ESC, 0x61, 0x01]); // Center align
    const alignLeft = new Uint8Array([ESC, 0x61, 0x00]); // Left align
    const cutPaper = new Uint8Array([GS, 0x56, 0x41, 0x00]); // Full cut

    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text + '\n\n\n');

    // Send commands in chunks
    await sendChunk(initCmd);
    await sendChunk(alignLeft);
    await sendChunk(encodedText);
    await sendChunk(cutPaper);

    return true;
  } catch (err: any) {
    console.error('Error writing to Bluetooth printer:', err);
    throw err;
  }
}

async function sendChunk(data: Uint8Array) {
  if (!activeCharacteristic) return;
  const chunkSize = 512;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (activeCharacteristic.properties.writeWithoutResponse) {
      await activeCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await activeCharacteristic.writeValue(chunk);
    }
  }
}

export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && 'bluetooth' in navigator;
}
