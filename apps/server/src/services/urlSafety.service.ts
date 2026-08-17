import dns from 'dns/promises';
import net from 'net';
import ipaddr from 'ipaddr.js';
import { env } from '../config/env';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

const BLOCKED_IPV4_LITERALS = new Set([
  '169.254.169.254',
]);

export class UrlSafetyError extends Error {
  code = 'unsafe_url';
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'UrlSafetyError';
  }
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return BLOCKED_HOSTNAMES.has(normalized) || normalized.endsWith('.localhost');
}

function isAllowlistedPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return (env.CRAWLER_PRIVATE_NETWORK_ALLOWLIST || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
    .some(entry => {
      if (entry.startsWith('*.')) {
        const suffix = entry.slice(1);
        return normalized.endsWith(suffix);
      }
      return normalized === entry;
    });
}

export function isPrivateAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);

    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      return isPrivateAddress((parsed as ipaddr.IPv6).toIPv4Address().toString());
    }

    const range = parsed.range();
    return range !== 'unicast';
  } catch {
    return true;
  }
}

async function resolveHostname(hostname: string) {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: false });
    return results.map(result => result.address);
  } catch (error) {
    throw new UrlSafetyError(`Could not resolve host "${hostname}"`);
  }
}

export async function assertSafeScrapeUrl(rawUrl: string, label = 'URL'): Promise<URL> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UrlSafetyError(`${label} is not a valid URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new UrlSafetyError(`${label} must use http or https`);
  }

  if (parsed.username || parsed.password) {
    throw new UrlSafetyError(`${label} must not include embedded credentials`);
  }

  if (!parsed.hostname || isBlockedHostname(parsed.hostname)) {
    throw new UrlSafetyError(`${label} points to a blocked hostname`);
  }

  if (BLOCKED_IPV4_LITERALS.has(parsed.hostname)) {
    throw new UrlSafetyError(`${label} points to a blocked metadata endpoint`);
  }

  if (!env.CRAWLER_ALLOW_PRIVATE_NETWORKS && !isAllowlistedPrivateHost(parsed.hostname)) {
    const addresses = await resolveHostname(parsed.hostname);
    const unsafeAddress = addresses.find(isPrivateAddress);

    if (unsafeAddress) {
      throw new UrlSafetyError(`${label} resolves to a private or reserved address (${unsafeAddress})`);
    }
  }

  return parsed;
}
