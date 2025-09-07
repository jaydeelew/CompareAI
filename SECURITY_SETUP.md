# 🔒 CompareAI Security Setup Guide

This guide provides detailed security implementation, monitoring, and troubleshooting for CompareAI's SSL/HTTPS setup.

> 📋 **Quick Start:** For daily workflow commands across all environments, see [DEV_WORKFLOW.md](DEV_WORKFLOW.md)

## 🎯 SSL Implementation Details

This document covers the security aspects of CompareAI's 4-environment structure:

### 🚀 Production SSL with Let's Encrypt

**When to use:** Deploying to a live server with a real domain name

> 📋 **Quick Commands:** For step-by-step deployment commands, see [Environment 4: AWS Production](DEV_WORKFLOW.md#environment-4-aws-production-https) in DEV_WORKFLOW.md

**Requirements:**
- Own a domain name (e.g., `compareintel.com`)
- Server accessible from the internet
- DNS pointing to your server

```bash
# Option 1: Pre-configured for CompareIntel.com (easiest)
# Automatically sets up SSL for both compareintel.com AND www.compareintel.com
./setup-compareintel-ssl.sh

# Option 2: General script with your details
# Automatically includes both domain and www.domain
./setup-ssl.sh compareintel.com jaydeelew@gmail.com
```

**What this provides:**
- ✅ Trusted SSL certificates from Let's Encrypt (free)
- ✅ Automatic HTTPS redirects
- ✅ Security headers and rate limiting
- ✅ Automatic certificate renewal
- ✅ Production-grade security configuration

### 🛠️ Development SSL (Self-Signed)

**When to use:** Local development and testing on your machine

**Requirements:**
- Local development environment
- Testing HTTPS functionality before production

> 📋 **For step-by-step environment commands:** See [Environment 2: Local Development (HTTPS)](DEV_WORKFLOW.md#environment-2-local-development-https) in DEV_WORKFLOW.md

### 🛠️ Development SSL (Self-Signed)

**When to use:** Local development and testing SSL-dependent features

> 💡 **Quick Commands:** See [Environment 2](DEV_WORKFLOW.md#environment-2-local-development-https) in DEV_WORKFLOW.md for basic setup commands

**Technical Details:**
- ✅ HTTPS on localhost for development
- ✅ Test SSL-dependent features locally
- ✅ Browser security warning (expected for self-signed certs)
- ✅ Same HTTPS behavior as production

## 🔄 SSL Environment Overview

> 📋 **For detailed workflow steps:** See [Four Development Environments](DEV_WORKFLOW.md#four-development-environments) in DEV_WORKFLOW.md

**SSL Implementation Summary:**
- **Environment 1 (Local HTTP):** No SSL - fastest for daily development
- **Environment 2 (Local HTTPS):** Self-signed certificates for SSL testing  
- **Environment 3 (Local Prod Test):** No SSL - production build testing
- **Environment 4 (AWS Production):** Let's Encrypt certificates for live site

**Key Security Points:**
- SSL certificates must be set up on AWS EC2 server (`54.163.207.252`)
- Local development uses self-signed certificates for testing
- Production uses trusted Let's Encrypt certificates
- All environments ensure consistent app behavior

**When to use HTTPS development:**
- Testing Service Workers, Geolocation, Camera access
- Before major deployments
- Testing integrations requiring HTTPS
- Debugging SSL-related issues

## 🔧 Production SSL Implementation

> 💡 **Quick Setup:** For basic production deployment commands, see [Environment 4: AWS Production](DEV_WORKFLOW.md#environment-4-aws-production-https) in DEV_WORKFLOW.md

### ⚠️ Important: Server Requirements

**Production Environment Details:**
- **Development:** Local machine - for coding and testing
- **Production:** AWS EC2 (`54.163.207.252`) - where `compareintel.com` points  
- **SSL Setup:** Must be done on AWS EC2, not your local machine

### Prerequisites for Production SSL

1. **Domain Requirements:**
   - Own a domain name (e.g., `myapp.com`)
   - DNS pointing to your server's IP address for both domain and www subdomain:
     - `compareintel.com` → `54.163.207.252`
     - `www.compareintel.com` → `54.163.207.252`
   - Server accessible from the internet on ports 80 and 443

2. **Server Requirements:**
   - Ubuntu/Debian server with sudo access
   - Docker and Docker Compose installed

### Step-by-Step Production Setup

1. **Update your domain in the configuration:**
   ```bash
   # Edit nginx/nginx.ssl.conf and replace 'your-domain.com' with your actual domain
   sed -i 's/your-domain.com/yourdomain.com/g' nginx/nginx.ssl.conf
   ```

2. **Run the SSL setup script:**
   ```bash
   # Pre-configured for CompareIntel.com
   ./setup-compareintel-ssl.sh
   
   # Or use the general script
   ./setup-ssl.sh compareintel.com jaydeelew@gmail.com
   ```

3. **Deploy with SSL:**
   ```bash
   docker compose -f docker-compose.ssl.yml up -d
   ```

4. **Test your secure site:**
   - Visit `https://compareintel.com`
   - Visit `https://www.compareintel.com`
   - Both should show the padlock icon and be secure
   - Check SSL grade at [SSL Labs](https://www.ssllabs.com/ssltest/)

## 🛡️ Security Features Implemented

### SSL/TLS Configuration
- **TLS 1.2 & 1.3** support only
- **Strong cipher suites** for encryption
- **Perfect Forward Secrecy** enabled
- **OCSP stapling** for faster certificate validation

### Security Headers
- **HSTS** (HTTP Strict Transport Security) - Forces HTTPS
- **CSP** (Content Security Policy) - Prevents XSS attacks
- **X-Frame-Options** - Prevents clickjacking
- **X-Content-Type-Options** - Prevents MIME sniffing
- **X-XSS-Protection** - Enables XSS filtering

### Rate Limiting
- **API endpoints** limited to 10 requests/second
- **Login attempts** limited to 5 attempts/minute
- **Burst handling** for traffic spikes

### Additional Security
- **HTTP to HTTPS redirects** - All traffic forced to SSL
- **Secure proxy headers** - Proper forwarding configuration
- **Access logging** - Monitor for suspicious activity

## 🔍 Troubleshooting

> 🛠️ **Basic Setup Issues:** If you're having problems with environment setup, see [Development Workflow Steps](DEV_WORKFLOW.md#development-workflow-steps) in DEV_WORKFLOW.md

### Common SSL Issues

1. **"SSL certificate not found"**
   - Ensure your domain points to your server
   - Check that ports 80 and 443 are open
   - Verify DNS propagation: `nslookup yourdomain.com`

2. **"Connection refused on port 443"**
   - Check if nginx is running: `docker-compose ps`
   - Verify port mapping in docker-compose file
   - Check firewall settings: `sudo ufw status`

3. **"Certificate expired"**
   - Check certificate status: `sudo certbot certificates`
   - Manual renewal: `sudo certbot renew`
   - Restart nginx: `docker-compose restart nginx`

### Verification Commands

```bash
# Check SSL certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test HTTP to HTTPS redirect
curl -I http://yourdomain.com

# Check certificate expiry
sudo certbot certificates

# View nginx logs
docker-compose logs nginx
```

## 📊 Monitoring SSL Health

### Automated Checks
- **Certificate renewal** runs daily via cron
- **Health endpoint** available at `/health`
- **Nginx status** monitored by Docker

### Manual Monitoring
- **SSL Labs Test:** https://www.ssllabs.com/ssltest/
- **Certificate Transparency:** https://crt.sh/
- **Security Headers:** https://securityheaders.com/

## 🚀 Performance Optimizations

The SSL configuration includes:
- **HTTP/2** support for faster loading
- **Gzip compression** for smaller transfers
- **Static asset caching** with proper headers
- **SSL session reuse** for faster handshakes

## 🔄 Maintenance

### Monthly Tasks
- [ ] Check SSL certificate expiry dates
- [ ] Review access logs for security issues
- [ ] Update security headers if needed
- [ ] Test SSL configuration

### Automatic Tasks (Set up by script)
- [ ] Daily certificate renewal checks
- [ ] Nginx restart after certificate renewal
- [ ] Log rotation for access logs

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs`
3. Test individual components separately
4. Ensure your domain and DNS are configured correctly

---

**Remember:** After implementing SSL, your website will show as secure with a padlock icon in browsers, and all traffic will be encrypted between your users and your server.
