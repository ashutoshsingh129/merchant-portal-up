// Backend encryption utility for API keys
// Using a reliable character shift that preserves all characters

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'stripe-connect-2025';

// Simple character shift - preserves all characters including special ones
export function simpleEncrypt(text: string, key: string): string {
    if (!text) return '';

    let result = '';
    for (let i = 0; i < text.length; i++) {
        const keyChar = key.charAt(i % key.length);
        const shift = keyChar.charCodeAt(0) % 10; // Use modulo 10 for smaller shifts

        // Shift all characters by the key value
        const charCode = text.charCodeAt(i);
        const shiftedCode = charCode + shift;
        result += String.fromCharCode(shiftedCode);
    }
    return Buffer.from(result, 'binary').toString('base64'); // Base64 encode
}

export function simpleDecrypt(encryptedText: string, key: string): string {
    try {
        if (!encryptedText) return '';

        // Decode from base64
        const decoded = Buffer.from(encryptedText, 'base64').toString('binary');

        // Then apply character shift decryption
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            const keyChar = key.charAt(i % key.length);
            const shift = keyChar.charCodeAt(0) % 10; // Use modulo 10 for smaller shifts

            // Reverse the shift
            const charCode = decoded.charCodeAt(i);
            const shiftedCode = charCode - shift;
            result += String.fromCharCode(shiftedCode);
        }

        return result;
    } catch (error) {
        console.error('Decryption failed:', error);
        return '';
    }
}

// Decrypt secret key received from frontend
export const decryptSecretKey = (encryptedSecretKey: string): string => {
    if (!encryptedSecretKey) return '';
    return simpleDecrypt(encryptedSecretKey, ENCRYPTION_KEY);
};

// Decrypt public key received from frontend
export const decryptPublicKey = (encryptedPublicKey: string): string => {
    if (!encryptedPublicKey) return '';
    return simpleDecrypt(encryptedPublicKey, ENCRYPTION_KEY);
};

// Encrypt function for backend use
export const encrypt = (text: string): string => {
    if (!text) return '';
    return simpleEncrypt(text, ENCRYPTION_KEY);
};

// Decrypt function for backend use
export const decrypt = (encryptedText: string): string => {
    if (!encryptedText) return '';
    return simpleDecrypt(encryptedText, ENCRYPTION_KEY);
};

