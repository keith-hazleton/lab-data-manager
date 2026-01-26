import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CertificateConfig {
  certDir: string;
  certFile: string;
  keyFile: string;
  validityDays: number;
}

export interface CertificateInfo {
  exists: boolean;
  certPath: string;
  keyPath: string;
  expiresAt: Date | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
}

function getDefaultConfig(): CertificateConfig {
  const certsDir = join(__dirname, '../../../data/certs');
  return {
    certDir: process.env.HTTPS_CERT_DIR || certsDir,
    certFile: process.env.HTTPS_CERT_FILE || 'server.crt',
    keyFile: process.env.HTTPS_KEY_FILE || 'server.key',
    validityDays: parseInt(process.env.HTTPS_CERT_VALIDITY_DAYS || '365', 10),
  };
}

/**
 * Check if openssl is available
 */
async function checkOpenSSLAvailable(): Promise<boolean> {
  try {
    await execAsync('which openssl');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get certificate expiration date from a certificate file
 */
async function getCertExpiry(certPath: string): Promise<Date | null> {
  try {
    const { stdout } = await execAsync(
      `openssl x509 -enddate -noout -in "${certPath}"`
    );
    // Output format: notAfter=Jan 25 00:00:00 2027 GMT
    const match = stdout.match(/notAfter=(.+)/);
    if (match) {
      return new Date(match[1].trim());
    }
  } catch {
    // If openssl fails, try to read the cert manually
  }
  return null;
}

/**
 * Get certificate info
 */
export async function getCertificateInfo(config?: Partial<CertificateConfig>): Promise<CertificateInfo> {
  const fullConfig = { ...getDefaultConfig(), ...config };
  const certPath = join(fullConfig.certDir, fullConfig.certFile);
  const keyPath = join(fullConfig.certDir, fullConfig.keyFile);

  const certExists = existsSync(certPath);
  const keyExists = existsSync(keyPath);
  const exists = certExists && keyExists;

  let expiresAt: Date | null = null;
  let isExpired = false;
  let daysUntilExpiry: number | null = null;

  if (exists) {
    expiresAt = await getCertExpiry(certPath);
    if (expiresAt) {
      const now = new Date();
      isExpired = expiresAt < now;
      daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    exists,
    certPath,
    keyPath,
    expiresAt,
    isExpired,
    daysUntilExpiry,
  };
}

/**
 * Generate self-signed certificate using openssl
 */
async function generateCertWithOpenSSL(config: CertificateConfig): Promise<void> {
  const certPath = join(config.certDir, config.certFile);
  const keyPath = join(config.certDir, config.keyFile);

  // Get hostname for CN
  let hostname = 'localhost';
  try {
    const { stdout } = await execAsync('hostname');
    hostname = stdout.trim() || 'localhost';
  } catch {
    // Use localhost if hostname fails
  }

  // Generate self-signed certificate
  // -nodes: no password on the key
  // -x509: self-signed certificate
  // -subj: subject info
  const subject = `/CN=${hostname}/O=Lab Data Manager/C=US`;

  const cmd = `openssl req -x509 -nodes -days ${config.validityDays} -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "${subject}" -addext "subjectAltName=DNS:${hostname},DNS:localhost,IP:127.0.0.1"`;

  try {
    await execAsync(cmd);
    console.log(`Generated self-signed certificate for: ${hostname}`);
    console.log(`  Certificate: ${certPath}`);
    console.log(`  Private key: ${keyPath}`);
    console.log(`  Valid for: ${config.validityDays} days`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to generate certificate: ${errorMessage}`);
  }
}

/**
 * Ensure certificates exist, generating them if necessary
 */
export async function ensureCertificates(config?: Partial<CertificateConfig>): Promise<CertificateInfo> {
  const fullConfig = { ...getDefaultConfig(), ...config };

  // Create certificate directory if it doesn't exist
  if (!existsSync(fullConfig.certDir)) {
    mkdirSync(fullConfig.certDir, { recursive: true });
    console.log(`Created certificate directory: ${fullConfig.certDir}`);
  }

  // Check current certificate status
  let info = await getCertificateInfo(fullConfig);

  // Generate new certificate if needed
  const needsGeneration = !info.exists || info.isExpired || (info.daysUntilExpiry !== null && info.daysUntilExpiry < 30);

  if (needsGeneration) {
    const reason = !info.exists ? 'not found' :
      info.isExpired ? 'expired' :
        `expiring soon (${info.daysUntilExpiry} days)`;
    console.log(`Certificate ${reason}, generating new self-signed certificate...`);

    // Check openssl availability
    const opensslAvailable = await checkOpenSSLAvailable();
    if (!opensslAvailable) {
      throw new Error('OpenSSL is required to generate certificates. Please install openssl.');
    }

    await generateCertWithOpenSSL(fullConfig);

    // Refresh info
    info = await getCertificateInfo(fullConfig);
  }

  return info;
}

/**
 * Load certificates for HTTPS server
 */
export function loadCertificates(config?: Partial<CertificateConfig>): { key: Buffer; cert: Buffer } {
  const fullConfig = { ...getDefaultConfig(), ...config };
  const certPath = join(fullConfig.certDir, fullConfig.certFile);
  const keyPath = join(fullConfig.certDir, fullConfig.keyFile);

  if (!existsSync(certPath)) {
    throw new Error(`Certificate file not found: ${certPath}`);
  }
  if (!existsSync(keyPath)) {
    throw new Error(`Key file not found: ${keyPath}`);
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

/**
 * Check if HTTPS should be enabled
 */
export function isHttpsEnabled(): boolean {
  // HTTPS is enabled by default in production unless explicitly disabled
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitlyDisabled = process.env.HTTPS_ENABLED === 'false';
  const explicitlyEnabled = process.env.HTTPS_ENABLED === 'true';

  return explicitlyEnabled || (isProduction && !explicitlyDisabled);
}
