/**
 * Frontend security utilities for input sanitization and XSS prevention.
 * Provides client-side defense-in-depth alongside backend security measures.
 */

/**
 * Sanitize user input to prevent XSS and other client-side attacks.
 * This is a lightweight client-side sanitizer for defense-in-depth.
 *
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns Sanitized string safe for display
 */
export function sanitizeUserInput(input: string, maxLength: number = 10000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Truncate to maximum length
  let sanitized = input.slice(0, maxLength);

  // Remove potentially dangerous HTML/JS patterns
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /<base[^>]*>/gi,
    /javascript:/gi,
    /data:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick, onerror
    /eval\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /Function\s*\(/gi,
  ];

  // Replace dangerous patterns with safe placeholders
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[CONTENT BLOCKED FOR SECURITY]');
  });

  return sanitized;
}

/**
 * Check if content contains potentially malicious patterns.
 *
 * @param content - Content to check
 * @returns true if potentially malicious, false otherwise
 */
export function isPotentiallyMalicious(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /document\./i,
    /window\./i,
    /alert\s*\(/i,
    /confirm\s*\(/i,
    /prompt\s*\(/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(content));
}

/**
 * Sanitize preview content for skill customizations.
 * Specifically designed for the skill preview functionality.
 *
 * @param content - Preview content to sanitize
 * @returns Sanitized content safe for preview display
 */
export function sanitizePreviewContent(content: string): string {
  if (!content) {
    return '';
  }

  // Apply general sanitization
  let sanitized = sanitizeUserInput(content, 5000); // Limit preview to 5000 chars

  // Additional validation for skill customization context
  if (isPotentiallyMalicious(sanitized)) {
    console.warn('[Security] Potentially malicious content detected in preview:', content.slice(0, 100));
    return '[PREVIEW BLOCKED: Content contains potentially unsafe patterns]';
  }

  return sanitized;
}

/**
 * HTML escape function for additional protection.
 * React already escapes content by default, but this provides extra safety.
 *
 * @param unsafe - Unsafe string
 * @returns HTML-escaped string
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return '';
  }

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}