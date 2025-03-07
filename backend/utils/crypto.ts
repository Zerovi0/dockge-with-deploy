import crypto from "crypto";
import { log } from "../log";

// Get encryption key from environment or generate a persistent one
let encryptionKey: Buffer;

/**
 * Initialize the encryption key
 * @param keyString Optional key string to use
 */
export function initEncryptionKey(keyString?: string): void {
    if (keyString) {
        // Use provided key
        encryptionKey = Buffer.from(keyString, "hex");
    } else if (process.env.ENCRYPTION_KEY) {
        // Use environment key
        encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    } else {
        // Generate a random key if none exists
        encryptionKey = crypto.randomBytes(32);
        log.info("crypto", "Generated new encryption key. For production, set ENCRYPTION_KEY environment variable.");
    }
}

/**
 * Encrypt text using AES-256-GCM
 * @param text Text to encrypt
 * @returns Encrypted text as string
 */
export function encryptText(text: string): string {
    if (!encryptionKey) {
        initEncryptionKey();
    }

    try {
        // Generate a random initialization vector
        const iv = crypto.randomBytes(16);
        
        // Create cipher using AES-256-GCM with our key and IV
        const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
        
        // Update the cipher with the data and get the encrypted output
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        // Get the authentication tag
        const authTag = cipher.getAuthTag();
        
        // Return IV + Auth Tag + Encrypted data as hex string
        return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
    } catch (error) {
        log.error("crypto", "Encryption failed: " + error);
        throw new Error("Failed to encrypt data");
    }
}

/**
 * Decrypt text using AES-256-GCM
 * @param encryptedText Encrypted text to decrypt
 * @returns Decrypted text
 */
export function decryptText(encryptedText: string): string {
    if (!encryptionKey) {
        initEncryptionKey();
    }

    try {
        // Split the encrypted text into IV, auth tag, and data
        const parts = encryptedText.split(":");
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted data format");
        }
        
        const iv = Buffer.from(parts[0], "hex");
        const authTag = Buffer.from(parts[1], "hex");
        const encryptedData = parts[2];
        
        // Create decipher
        const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt the data
        let decrypted = decipher.update(encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    } catch (error) {
        log.error("crypto", "Decryption failed: " + error);
        throw new Error("Failed to decrypt data");
    }
}
