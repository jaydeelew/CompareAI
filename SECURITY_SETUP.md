# 🔒 CompareAI Security Setup Guide

Your website shows as "insecure" because it's only serving HTTP traffic. This guide will help you implement HTTPS/SSL encryption to make your website secure.

## 🎯 SSL Setup for Different Environments

You'll need SSL for both development and production environments. Here's how to set up each:

### 🚀 Production SSL with Let's Encrypt

**When to use:** Deploying to a live server with a real domain name

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

```bash
# Create self-signed certificates for localhost
./create-dev-ssl.sh

# Start development environment with SSL
docker-compose -f docker-compose.dev-ssl.yml up -d
```

**What this provides:**
- ✅ HTTPS on localhost for development
- ✅ Test SSL-dependent features locally
- ✅ Browser security warning (expected for self-signed certs)
- ✅ Same HTTPS behavior as production

## 🔄 Typical Development Workflow

**Important:** SSL certificates must be set up on your AWS EC2 server (`54.163.207.252`) where `compareintel.com` points, not on your local development machine.

**Most developers will use both setups:**

1. **During Development (Local Machine):**
   ```bash
   # Option A: HTTP development (faster, use 90% of the time)
   docker compose up
   # Access at: http://localhost
   
   # Option B: HTTPS development (when testing SSL features)
   ./create-dev-ssl.sh  # Run once to create self-signed certs
   docker compose -f docker-compose.dev-ssl.yml up
   # Access at: https://localhost (accept browser warning)
   ```

2. **When Deploying to Production (AWS EC2):**
   ```bash
   # SSH to your production server where compareintel.com points
   ssh -i CompareAI.pem ubuntu@54.163.207.252
   
   # Pull latest changes to get SSL setup files
   git pull origin master
   
   # Set up production HTTPS with trusted certificates (one-time)
   ./setup-compareintel-ssl.sh
   
   # Deploy with SSL
   docker compose -f docker-compose.ssl.yml up -d
   # Access at: https://compareintel.com (trusted, no warnings)
   ```

**Why you need both:**
- **Development SSL** lets you test HTTPS features locally (optional, use when needed)
- **Production SSL** provides trusted certificates for real users (required)
- **HTTP development** is faster for daily development work
- All environments ensure your app works consistently

**When to use HTTPS development:**
- Testing Service Workers, Geolocation, Camera access
- Before major deployments
- Testing integrations requiring HTTPS
- Debugging SSL-related issues

## 🔧 Manual Setup Steps

### ⚠️ Important: AWS EC2 vs Local Development

**Your setup:**
- **Development:** Local machine (`172.23.193.222`) - for coding and testing
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

### Common Issues

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
