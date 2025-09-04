const { URL } = require('url');

class URLValidator {
  constructor() {
    // Blacklisted domains (can be moved to database later)
    this.blacklistedDomains = [
      'malicious-site.com',
      'badsite.example',
      'scam.test'
    ];
  }

  validateUrl(urlString) {
    try {
      const url = new URL(urlString);
      
      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
      }

      // Check for internal network addresses
      if (this.isInternalNetwork(url.hostname)) {
        throw new Error('Internal network addresses are not allowed');
      }

      // Check blacklisted domains
      if (this.isBlacklistedDomain(url.hostname)) {
        throw new Error('Domain is blacklisted');
      }

      // Check for localhost variants
      if (this.isLocalhost(url.hostname)) {
        throw new Error('Localhost addresses are not allowed');
      }

      return true;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  isInternalNetwork(hostname) {
    // Check for private IP ranges
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipRegex);
    
    if (match) {
      const [, a, b, c, d] = match.map(Number);
      
      // Private IP ranges:
      // 10.0.0.0/8
      // 172.16.0.0/12
      // 192.168.0.0/16
      return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 127 // Loopback
      );
    }
    
    return false;
  }

  isBlacklistedDomain(hostname) {
    const domain = hostname.toLowerCase();
    
    // Check exact matches
    if (this.blacklistedDomains.includes(domain)) {
      return true;
    }
    
    // Check subdomains
    return this.blacklistedDomains.some(blacklisted => 
      domain.endsWith('.' + blacklisted)
    );
  }

  isLocalhost(hostname) {
    const localhostVariants = [
      'localhost',
      '0.0.0.0',
      '[::]',
      '[::1]'
    ];
    
    return localhostVariants.includes(hostname.toLowerCase());
  }

  async checkSafeBrowsing(url) {
    // Placeholder for Google Safe Browsing API integration
    // In a real implementation, this would call the API
    console.log(`Safe Browsing check for: ${url}`);
    return true; // Assume safe for now
  }
}

module.exports = URLValidator;