declare module 'react-native-zeroconf' {
  import { EventEmitter } from 'events';

  interface Service {
    name: string;
    fullName: string;
    host: string;
    port: number;
    addresses: string[];
    txt: Record<string, string>;
  }

  class Zeroconf extends EventEmitter {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    getServices(): Record<string, Service>;
  }

  export default Zeroconf;
  export type { Service };
}
