# Security Guidelines

## Environment Variables

This project uses environment variables to manage sensitive configuration. **NEVER commit actual `.env` files with real credentials to version control.**

### Setup Instructions

1. **Frontend Environment Setup**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and update with your values
   # Only contains VITE_API_URL - safe for development
   ```

2. **Backend Environment Setup**
   ```bash
   # Copy the example file
   cp backend/.env.example backend/.env
   
   # Edit backend/.env and update these CRITICAL values:
   # - SECRET_KEY: Generate a secure random key
   # - ANTHROPIC_API_KEY: Your Anthropic API key from https://console.anthropic.com/
   # - DATABASE_URL: Your PostgreSQL connection string
   ```

### Generating Secure Keys

For production `SECRET_KEY`, use:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Or:
```bash
openssl rand -hex 32
```

### Protected Files

The `.gitignore` is configured to exclude:

- **Environment files**: `.env`, `.env.*`, all environment file variants
- **API keys**: Files containing `api_key`, `apikey`, `secret_key`, etc.
- **Credentials**: `credentials.json`, `secrets.json`, etc.
- **Certificates**: `*.pem`, `*.key`, `*.crt`, `*.cer`
- **Database files**: `*.db`, `*.sqlite`, `*.dump`
- **Cloud credentials**: AWS, GCP, Azure credential files
- **Backup files**: `*.bak`, `*.backup`, etc.

### What to Do If You Accidentally Commit Secrets

If you accidentally commit a file with real secrets:

1. **Immediately rotate/regenerate all exposed credentials**
2. Remove the file from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/secret/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (⚠️ coordinate with team first):
   ```bash
   git push origin --force --all
   ```

### API Key Management

- Store API keys in environment variables, not in code
- Use different API keys for development and production
- Rotate API keys regularly
- Monitor API key usage for anomalies
- Revoke unused API keys immediately

### Production Checklist

Before deploying to production:

- [ ] All `.env` files use strong, unique secrets
- [ ] `SECRET_KEY` is a cryptographically secure random string
- [ ] `DEBUG=False` in production
- [ ] Database uses strong password
- [ ] CORS origins are restricted to your domain
- [ ] Rate limiting is properly configured
- [ ] HTTPS is enforced
- [ ] Environment variables are set via secure secrets management (e.g., GitHub Secrets, AWS Secrets Manager)

## Reporting Security Issues

If you discover a security vulnerability, please email security@playstudy.ai instead of creating a public issue.
